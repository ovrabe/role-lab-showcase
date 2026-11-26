import changelog from "../../CHANGELOG.md?raw";
import { appVersion } from "../buildFlags";
import { activeTasks, botHealth, botStats, endpointStats, sumDays, taskStats } from "./aggregate";
import { change, digest } from "./digest";
import { count, usd } from "./AdminParts";
import { adminEndpoints, attentionItems, endpointNames, type AttentionItem } from "./attention";
import { AttentionBox } from "./AttentionBox";
import { SummaryCard } from "./SummaryCard";
import { AskDataCard } from "./AskDataCard";
import { cardClass, HealthRow, KpiCard, SweepBar, type Health } from "./OverviewParts";
import type { AdminOverview } from "./adminApi";

// "Přehled": how things go at a glance. The AI summary and what needs attention on top, then
// the big numbers with trends, the funnel, learning results, operating health and the most
// active tasks. Every detail lives in the other tabs (docs/PRODUCTION.md, part 11).

const skillNames: Record<string, string> = {
  framing: "Zadání a kontext", decomposition: "Rozklad úkolu", verification: "Ověřování", iteration: "Iterace", judgment: "Úsudek a výsledek",
};
const comma = (value: number) => String(value).replace(".", ",");
const releaseDate = changelog.match(/^## \S+ – (.+)$/m)?.[1] ?? "";

function healthOf(calls: number, errors: number): Health {
  if (calls === 0) return "idle";
  const rate = errors / calls;
  return rate > 0.2 ? "critical" : rate > 0.05 ? "warning" : "ok";
}

export function OverviewTab({ data, token, onOpenTab }: { data: AdminOverview; token: string; onOpenTab: (tab: AttentionItem["tab"]) => void }) {
  const titleOf = (id: string) => {
    if (id === "custom") return "Vlastní výzvy";
    const task = data.tasks.find((candidate) => candidate.id === id);
    return task ? `${task.roleTitle}: ${task.taskTitle}` : id;
  };
  const now = digest(data.days);
  const before = digest(data.previousDays);
  const perDay = [...data.days].reverse().map((day) => digest([day]));
  const total = sumDays(data.days);

  const funnel = [
    { label: "Návštěva", value: now.visitors },
    { label: "Začatý úkol", value: now.funnel.started },
    { label: "První zpráva", value: now.funnel.firstMessage },
    { label: "Odevzdání", value: now.funnel.submitted },
    { label: "Hodnocení", value: now.funnel.evaluated },
  ];
  const drops = funnel.slice(1).map((step, index) => ({ from: funnel[index], to: step, lost: funnel[index].value - step.value }));
  const biggestDrop = drops.reduce((worst, drop) => (drop.lost > worst.lost ? drop : worst), drops[0]);

  const ratings = data.feedback.filter((item) => item.kind === "evaluation");
  const agree = ratings.filter((item) => item.kind === "evaluation" && (item.rating === "yes" || item.rating === "rather_yes")).length;
  const endpoints = endpointStats(total).filter((row) => !adminEndpoints.has(row.endpoint));
  const bots = botStats(total);
  const spentShare = data.budget.totalUsd > 0 ? data.budget.spentTodayUsd / data.budget.totalUsd : 0;
  const topTasks = activeTasks(total).slice(0, 3).map((task) => taskStats(total, task));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-6 items-stretch">
        <div className="flex-[999_1_560px] min-w-0 flex">
          <SummaryCard token={token} days={data.days.length} />
        </div>
        <div className="flex-[1_1_320px] min-w-0">
          <AttentionBox items={attentionItems(data, titleOf)} onOpenTab={onOpenTab} />
        </div>
      </div>

      <AskDataCard token={token} days={data.days.length} />

      <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(220px,1fr))]">
        <KpiCard label="Návštěvníci" value={count(now.visitors)} changePercent={change(now.visitors, before.visitors)} values={perDay.map((day) => day.visitors)} />
        <KpiCard label="Ohodnocené pokusy" value={count(now.funnel.evaluated)} changePercent={change(now.funnel.evaluated, before.funnel.evaluated)} values={perDay.map((day) => day.funnel.evaluated)} />
        <KpiCard
          label="Průměrná úroveň"
          value={now.averageLevel === null ? "–" : comma(now.averageLevel)}
          changePercent={now.averageLevel !== null && before.averageLevel !== null ? change(now.averageLevel, before.averageLevel) : null}
          note={now.averageLevel === null ? "zatím žádné hodnocení" : undefined}
          values={perDay.map((day) => day.averageLevel ?? 0)}
        />
        <KpiCard
          label="Útrata"
          value={usd(now.spendUsd)}
          changePercent={change(now.spendUsd, before.spendUsd)}
          note={now.funnel.evaluated > 0 ? `${usd(now.spendUsd / now.funnel.evaluated)} na pokus` : undefined}
          values={perDay.map((day) => day.spendUsd)}
        />
      </div>

      <section aria-labelledby="funnel-heading" className={`${cardClass} space-y-4`}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="funnel-heading" className="text-xl font-bold">Kudy lidé prochází</h2>
          {biggestDrop.lost > 0 && (
            <p className="text-sm text-ink-muted">
              Největší odpad: {biggestDrop.from.label.toLowerCase()} → {biggestDrop.to.label.toLowerCase()}
            </p>
          )}
        </div>
        {funnel.map((step, index) => (
          <div key={step.label} className="grid grid-cols-[110px_minmax(0,1fr)_96px] sm:grid-cols-[140px_minmax(0,1fr)_110px] items-center gap-3">
            <span className="text-sm font-semibold">{step.label}</span>
            <SweepBar share={funnel[0].value > 0 ? step.value / funnel[0].value : 0} height="h-3.5" />
            <span className="text-sm text-right tabular-nums">
              {count(step.value)}
              {index > 0 && <span className="text-ink-muted"> · {funnel[index - 1].value > 0 ? `${Math.round((step.value / funnel[index - 1].value) * 100)} %` : "–"}</span>}
            </span>
          </div>
        ))}
      </section>

      <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(300px,1fr))]">
        <section aria-labelledby="skills-heading" className={`${cardClass} space-y-3`}>
          <h2 id="skills-heading" className="text-lg font-bold">Pět dovedností</h2>
          {Object.keys(now.skills).length === 0 && <p className="text-sm text-ink-muted">Zatím žádné hodnocení.</p>}
          {Object.entries(now.skills).map(([skill, score]) => (
            <div key={skill} className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span>{skillNames[skill] ?? skill}</span>
                <span className="font-semibold text-progress tabular-nums">{comma(score)}</span>
              </div>
              <SweepBar share={score / 4} />
            </div>
          ))}
          <p className="text-sm text-ink-muted">
            Nalezené záludnosti {now.trapsFoundShare === null ? "–" : `${Math.round(now.trapsFoundShare * 100)} %`} · s hodnocením souhlasí{" "}
            {ratings.length > 0 ? `${Math.round((agree / ratings.length) * 100)} %` : "–"}
          </p>
        </section>

        <section aria-labelledby="health-heading" className={`${cardClass} space-y-3`}>
          <h2 id="health-heading" className="text-lg font-bold">Zdraví provozu</h2>
          {endpoints.length === 0 && <p className="text-sm text-ink-muted">Zatím žádná volání modelů.</p>}
          {endpoints.map((row) => (
            <HealthRow
              key={row.endpoint}
              name={endpointNames[row.endpoint] ?? row.endpoint}
              health={healthOf(row.calls, row.errors)}
              detail={`${row.median ? `medián ${row.median}` : "–"} · ${row.calls > 0 ? Math.round((row.errors / row.calls) * 100) : 0} % chyb`}
            />
          ))}
          {bots.checked > 0 && (
            <HealthRow
              name="Ochrana proti robotům"
              health={botHealth(bots)}
              detail={[
                `lidé ${count(bots.human)}`,
                `roboti ${count(bots.bot)}`,
                // Known bots with their names, the three most frequent: "známí roboti 3 (googlebot 2, bingbot 1)".
                ...(bots.verifiedBot > 0
                  ? [`známí roboti ${count(bots.verifiedBot)}${bots.knownBots.length > 0 ? ` (${bots.knownBots.slice(0, 3).map(([name, value]) => `${name} ${count(value)}`).join(", ")})` : ""}`]
                  : []),
                `neověřeno ${count(bots.unknown)}`,
                ...(bots.skipped > 0 ? [`přeskočeno ${count(bots.skipped)}`] : []),
              ].join(" · ")}
            />
          )}
          <div className="space-y-1.5 pt-1">
            <div className="flex justify-between text-sm">
              <span>Dnešní rozpočet</span>
              <span className="tabular-nums">
                {usd(data.budget.spentTodayUsd)} / {usd(data.budget.totalUsd)}
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-track">
              <div className={`h-2.5 rounded-full ${spentShare >= 0.7 ? "bg-[#d08a00]" : "bg-[image:var(--progress-sweep)]"}`} style={{ width: `${Math.min(1, spentShare) * 100}%` }} />
            </div>
          </div>
        </section>

        <section aria-labelledby="tasks-heading" className={`${cardClass} space-y-3`}>
          <h2 id="tasks-heading" className="text-lg font-bold">Nejaktivnější úkoly</h2>
          {topTasks.length === 0 && <p className="text-sm text-ink-muted">Zatím nikdo nezačal úkol.</p>}
          {topTasks.map((task) => (
            <button key={task.task} type="button" onClick={() => onOpenTab("tasks")} className="w-full text-left flex flex-col rounded-[16px] bg-paper px-3 py-2.5 hover:-translate-y-0.5 transition-transform">
              <span className="text-sm font-semibold">{titleOf(task.task)}</span>
              <span className="text-sm text-ink-muted">
                {count(task.started)} začato · {count(task.evaluated)} ohodnoceno{task.averageLevel !== null ? ` · úroveň ${comma(task.averageLevel)}` : ""}
              </span>
            </button>
          ))}
          <p className="text-sm text-ink-muted">Vlastní výzvy: {count(now.customTasksGenerated)} vygenerováno · dokončené prohlídky {count(now.tourCompleted)}</p>
        </section>
      </div>

      <p className="text-sm text-ink-muted">
        Verze {appVersion}
        {releaseDate ? ` · vydáno ${releaseDate}` : ""} · anonymní denní součty, uchovávají se 90 dní ·{" "}
        {data.notifications.slack
          ? `upozornění do Slacku zapnutá${data.notifications.morning ? ", ranní zpráva kolem 8:00" : ", ranní zpráva vypnutá (chybí CRON_SECRET)"}`
          : "Slack není připojený (SLACK_WEBHOOK_URL)"}
      </p>
    </div>
  );
}
