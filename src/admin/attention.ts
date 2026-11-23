import { activeTasks, endpointStats, sumDays, taskStats } from "./aggregate.js";
import type { AdminOverview } from "./adminApi.js";

/**
 * "Co řešit" on the admin overview: the few things that need the author's attention, worked out
 * from the same numbers as the tabs. Each rule needs a minimum amount of data, so a single
 * attempt never raises an alarm. Thresholds are deliberately simple and written out here.
 */

export type AttentionItem = { level: "warning" | "info"; text: string; tab: "overview" | "tasks" | "models" | "approvals" | "feedback" };

export const thresholds = {
  spendShare: 0.7, // of the daily ceiling
  errorRate: 0.05, // of calls to one endpoint
  minCalls: 5,
  trapMissRate: 0.8, // of evaluations of one task
  minEvaluations: 3,
  firstMessageRate: 0.5, // of started attempts
  minStarted: 5,
  feedbackDays: 7,
};

export const endpointNames: Record<string, string> = {
  chat: "Asistent", evaluate: "Hodnocení", challenge: "Výzvy", why: "Proč tohle skóre?", customTask: "Generátor vlastní výzvy",
  adminSummary: "AI shrnutí v adminu", adminAsk: "Otázky na data v adminu",
};

// The author's own AI calls in the admin: shown in "Modely a útrata", left out of the testers' health.
export const adminEndpoints = new Set(["adminSummary", "adminAsk"]);

const percent = (share: number) => `${Math.round(share * 100)} %`;

export function attentionItems(data: AdminOverview, titleOf: (taskId: string) => string, now = new Date()): AttentionItem[] {
  const items: AttentionItem[] = [];
  const total = sumDays(data.days);

  const spendShare = data.budget.totalUsd > 0 ? data.budget.spentTodayUsd / data.budget.totalUsd : 0;
  if (spendShare >= thresholds.spendShare) {
    items.push({ level: "warning", text: `Dnešní útrata je ${percent(spendShare)} denního stropu. Po jeho vyčerpání se volání modelů zastaví.`, tab: "models" });
  }
  const refused = (total["budget.refused.limit_daily"] ?? 0) + (total["budget.refused.limit_person"] ?? 0);
  if (refused > 0) items.push({ level: "warning", text: `Rozpočet ${refused}× odmítl volání. Zvaž zvýšení stropu.`, tab: "overview" });

  for (const endpoint of endpointStats(total)) {
    if (endpoint.calls >= thresholds.minCalls && endpoint.errors / endpoint.calls > thresholds.errorRate) {
      items.push({ level: "warning", text: `${endpointNames[endpoint.endpoint] ?? endpoint.endpoint}: ${percent(endpoint.errors / endpoint.calls)} volání skončilo chybou.`, tab: "models" });
    }
  }
  const clientErrors = (total["client_error.render"] ?? 0) + (total["client_error.script"] ?? 0);
  if (clientErrors > 0) items.push({ level: "warning", text: `Na stránce se ${clientErrors}× objevila chyba. Najdi ji v logu prohlížeče nebo se zeptej testerů.`, tab: "overview" });

  for (const task of activeTasks(total)) {
    const stats = taskStats(total, task);
    if (stats.started >= thresholds.minStarted && stats.firstMessage / stats.started < thresholds.firstMessageRate) {
      items.push({ level: "info", text: `${titleOf(task)}: jen ${percent(stats.firstMessage / stats.started)} lidí napíše asistentovi. Zadání možná odrazuje.`, tab: "tasks" });
    }
    for (const [trap, result] of Object.entries(stats.traps)) {
      const all = result.caught + result.partial + result.missed;
      if (all >= thresholds.minEvaluations && result.missed / all >= thresholds.trapMissRate) {
        items.push({ level: "info", text: `${titleOf(task)}: záludnost ${trap} mine ${percent(result.missed / all)} lidí. Může být příliš skrytá.`, tab: "tasks" });
      }
    }
    if (stats.flagged > 0) items.push({ level: "info", text: `${titleOf(task)}: ${stats.flagged}× hodnocení označené ke kontrole člověkem.`, tab: "tasks" });
  }
  const unreadable = total["evaluate.unreadable_reply"] ?? 0;
  if (unreadable > 0) items.push({ level: "info", text: `Hodnotitel ${unreadable}× vrátil nečitelnou odpověď (server se zeptal znovu).`, tab: "models" });

  if (data.pendingShares.length > 0) items.push({ level: "info", text: `Čeká ${data.pendingShares.length} ${data.pendingShares.length === 1 ? "žádost" : "žádostí"} o sdílení vlastní výzvy.`, tab: "approvals" });
  if (data.generationOff) items.push({ level: "info", text: "Generování vlastních výzev je vypnuté.", tab: "approvals" });

  const since = now.getTime() - thresholds.feedbackDays * 24 * 60 * 60 * 1000;
  const recentFeedback = data.feedback.filter((item) => Date.parse(item.at) >= since).length;
  if (recentFeedback > 0) items.push({ level: "info", text: `Nová zpětná vazba za posledních ${thresholds.feedbackDays} dní: ${recentFeedback}.`, tab: "feedback" });

  // Warnings first, so the most urgent thing is on top.
  return items.sort((a, b) => (a.level === b.level ? 0 : a.level === "warning" ? -1 : 1));
}
