import { notify } from "./notify.js";
import { addMetrics } from "./metrics.js";
import { createHmac } from "node:crypto";
import { badRequest } from "./http.js";
import type { RateLimiter } from "./rateLimit.js";
import type { IssueTracker } from "./issues.js";

/**
 * A daily spending ceiling in dollars, on top of the call counts in rateLimit.ts.
 * Call counts cannot tell a short call from a huge one: a script that sends long forged
 * conversations could spend the whole credit within the counts. Here every call adds what it
 * really cost (from the token counts Anthropic returns), and new calls stop once a day's
 * ceiling is reached: per IP address, so one source cannot use up the day, and in total.
 */
export const dailyBudgetUsd = { perIp: 1.5, total: 3 };
// Share of the daily ceiling at which the author gets a Slack notification.
const budgetWarningShare = 0.7;

// Dollars per million tokens (Claude API docs, November 2026). One token costs that many
// millionths of a dollar, so the counters hold whole micro-dollars.
const prices: Record<string, { input: number; output: number; cacheRead: number }> = {
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.1 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheRead: 0.01 },
};
// Writing the 5-minute cache costs 1.25x the input price.
const cacheWriteFactor = 1.25;

export type Usage = {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
};

/** What one call cost, in micro-dollars. An unknown model is priced like the dearest one. */
export function costMicroUsd(model: string, usage: Usage): number {
  const price = prices[model] ?? prices["claude-opus-5-5"];
  return Math.ceil(
    usage.input_tokens * price.input +
      (usage.cache_creation_input_tokens ?? 0) * price.input * cacheWriteFactor +
      (usage.cache_read_input_tokens ?? 0) * price.cacheRead +
      usage.output_tokens * price.output,
  );
}

const pragueDay = (limiter: RateLimiter) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Prague" }).format((limiter.now ?? (() => new Date()))());

function budgetKeys(limiter: RateLimiter, request: Request) {
  const day = pragueDay(limiter);
  const ip = request.headers.get("x-real-ip")?.trim() || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const ipHash = createHmac("sha256", limiter.secret).update(ip).digest("hex").slice(0, 16);
  return [
    { key: `spend:${day}:ip:${ipHash}`, max: dailyBudgetUsd.perIp * 1_000_000, code: "limit_person" },
    { key: `spend:${day}:total`, max: dailyBudgetUsd.total * 1_000_000, code: "limit_daily" },
  ] as const;
}

/**
 * The refusal to send when today's money is spent, or null when the call may go ahead.
 * The first refusal of the day for each ceiling files a backlog issue, so the author learns
 * whether it is interest (raise the ceiling) or one source hammering the server.
 */
export async function budgetResponse(limiter: RateLimiter, request: Request, issues: IssueTracker | null = null): Promise<Response | null> {
  if (!limiter.counter.add) return null;
  try {
    for (const { key, max, code } of budgetKeys(limiter, request)) {
      if ((await limiter.counter.add(key, 0)) >= max) {
        await alertOnce(limiter, issues, code);
        await addMetrics(limiter.metrics, { [`budget.refused.${code}`]: 1 });
        return badRequest(code, "Daily budget reached.", 429);
      }
    }
    return null;
  } catch (error) {
    // Same rule as the call counts: no counter, no protection, no call.
    console.error("Budget counter failed:", error);
    return badRequest("service_unavailable", "Budget counter unavailable.", 503);
  }
}

/** Adds what a finished call cost. Never fails the call: a lost record is only logged. */
export async function recordSpend(limiter: RateLimiter, request: Request, model: string, usage: Usage): Promise<void> {
  if (!limiter.counter.add) return;
  const cost = costMicroUsd(model, usage);
  try {
    for (const { key } of budgetKeys(limiter, request)) await limiter.counter.add(key, cost);
    const day = pragueDay(limiter);
    const spent = await limiter.counter.add(`spend:${day}:total`, 0);
    // Once a day, when the day's spending first passes 70 % of the ceiling.
    if (spent >= budgetWarningShare * dailyBudgetUsd.total * 1_000_000 && (await limiter.counter.add(`alert:${day}:budget_warning`, 1)) === 1) {
      await notify(limiter, "budget", `:money_with_wings: Dnešní útrata je ${(spent / 1_000_000).toFixed(2).replace(".", ",")} $ z ${dailyBudgetUsd.total} $ (přes 70 % stropu).`, request);
    }
  } catch (error) {
    console.error("Recording the spend failed:", error);
  }
}

async function alertOnce(limiter: RateLimiter, issues: IssueTracker | null, code: "limit_person" | "limit_daily"): Promise<void> {
  if (!issues || !limiter.counter.add) return;
  try {
    const day = pragueDay(limiter);
    if ((await limiter.counter.add(`alert:${day}:budget:${code}`, 1)) !== 1) return;
    const spent = (await limiter.counter.add(`spend:${day}:total`, 0)) / 1_000_000;
    const whose = code === "limit_person" ? `jedna IP adresa (strop ${dailyBudgetUsd.perIp} $)` : `všichni dohromady (strop ${dailyBudgetUsd.total} $)`;
    await issues.create({
      title: code === "limit_person" ? "Denní rozpočet: jedna adresa vyčerpala svůj podíl" : "Denní rozpočet: vyčerpaný pro všechny",
      body: [
        `Dnes se vyčerpal denní rozpočet na volání Clauda: ${whose}.`,
        `Celkem dnes utraceno: ${spent.toFixed(2)} $ z ${dailyBudgetUsd.total} $.`,
        "",
        code === "limit_person"
          ? "Lidé z té adresy dostávají až do půlnoci hlášku o vyčerpaném limitu, ostatní pokračují. Když je to jeden tester s několika pokusy, je to v pořádku. Když se to opakuje každý den, může jít o zneužití."
          : "Až do půlnoci dostávají všichni hlášku o vyčerpaném denním limitu. Když jde o zájem testerů, zvaž zvýšení stropu v server/spendBudget.ts (a dobití kreditu).",
        "",
        "Tohle issue vzniká nejvýš jednou denně pro každý strop. Po přečtení ho zavři.",
      ].join("\n"),
      labels: ["provoz"],
    });
  } catch (error) {
    console.error("Filing the budget issue failed:", error);
  }
}
