import { z } from "zod";
import type { ServerContent } from "./content.js";
import type { IssueTracker } from "./issues.js";
import { badRequest, json, limitResponse, readJson } from "./http.js";
import type { RateLimiter } from "./rateLimit.js";
import { addMetrics, pragueDay as metricsDay, type MetricEntries } from "./metrics.js";
import { dailyVisitorMark, PageEvent, pageEventMetrics } from "./pageEvents.js";

/**
 * Anonymous daily statistics for the author (web version, src/ai/track.ts): how many attempts
 * were started, submitted and evaluated per task, and how many challenges were evaluated.
 * Only totals per day and task are stored, no identity and no text; they expire after two days.
 * The first event of a new day files a backlog issue with yesterday's numbers.
 * Custom tasks are counted by the server itself (countCustomTask), as daily totals only.
 * The same events, and the page events of pageEvents.ts, also go into the 90-day metrics for
 * the admin page, together with an estimate of unique visitors (no identity is kept).
 */
const events = ["task_started", "task_submitted", "task_evaluated", "challenge_evaluated"] as const;
const StatsRequest = z.object({ event: z.enum(events), id: z.string().max(80) });

const pragueDay = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Prague" }).format(date);
const key = (day: string, event: string, id: string) => `stats:${day}:${event}:${id}`;

// Custom tasks have random ids, so they are counted together: how many were generated,
// evaluated and asked to be shared. Called by the server, never by the page.
const customEvents = ["generated", "evaluated", "shared"] as const;
type CustomEvent = (typeof customEvents)[number];
const customKey = (day: string, event: CustomEvent) => key(day, `custom_${event}`, "all");

export async function countCustomTask(limiter: RateLimiter, event: CustomEvent): Promise<void> {
  if (!limiter.counter.add) return;
  try {
    await limiter.counter.add(customKey(pragueDay((limiter.now ?? (() => new Date()))()), event), 1);
  } catch (error) {
    console.error("Custom task statistics failed:", error);
  }
}

export async function handleStats(
  request: Request,
  { content, limiter, issues = null }: { content: ServerContent; limiter: RateLimiter; issues?: IssueTracker | null },
): Promise<Response> {
  const body = await readJson(request, 1_000);
  if (body instanceof Response) return body;
  const taskEvent = StatsRequest.safeParse(body);
  const pageEvent = taskEvent.success ? null : PageEvent.safeParse(body);
  if (!taskEvent.success && !pageEvent?.success) return badRequest("invalid_request", "Invalid event.");
  const id = taskEvent.success ? taskEvent.data.id : pageEvent!.data!.id;
  // Only ids that exist, so nobody can fill the store with made-up keys. Generated custom
  // tasks are reported together as "custom" (src/ai/track.ts).
  const isTask = (taskId: string) => taskId === "custom" || content.roles.activeRoles.some((role) => role.id === taskId);
  const known = taskEvent.success
    ? taskEvent.data.event === "challenge_evaluated"
      ? content.challenges.challenges.some((challenge) => challenge.id === id)
      : isTask(id)
    : ["task_step", "attempt", "review_change"].includes(pageEvent!.data!.event)
      ? isTask(id)
      : true;
  if (!known) return badRequest("invalid_request", "Unknown id.");
  if (!limiter.counter.add) return json({ ok: true });
  const limited = await limitResponse(limiter, "stats", request);
  if (limited) return limited;

  const now = (limiter.now ?? (() => new Date()))();
  const metrics: MetricEntries = taskEvent.success
    ? taskEvent.data.event === "challenge_evaluated"
      ? {}
      : { [`funnel.${id}.${taskEvent.data.event.replace("task_", "")}`]: 1 }
    : pageEventMetrics(pageEvent!.data!, id);
  await addMetrics(limiter.metrics, metrics, now);
  try {
    await limiter.metrics?.addUnique(metricsDay(now), "visitors", dailyVisitorMark(request, limiter.secret, metricsDay(now)));
  } catch (error) {
    console.error("Counting visitors failed:", error);
  }
  // The daily backlog issue below knows only the fixed tasks and challenges.
  if (!taskEvent.success) return json({ ok: true });
  const { event } = taskEvent.data;
  try {
    await limiter.counter.add(key(pragueDay(now), event, id), 1);
    if ((await limiter.counter.add(`alert:${pragueDay(now)}:stats`, 1)) === 1) await fileYesterday(content, limiter, issues, now);
  } catch (error) {
    // Statistics are a convenience: a failure is logged, the page is not bothered.
    console.error("Statistics failed:", error);
  }
  return json({ ok: true });
}

async function fileYesterday(content: ServerContent, limiter: RateLimiter, issues: IssueTracker | null, now: Date) {
  if (!issues || !limiter.counter.readMany) return;
  const day = pragueDay(new Date(now.getTime() - 24 * 60 * 60 * 1000));
  const tasks = content.roles.activeRoles;
  const taskEvents = ["task_started", "task_submitted", "task_evaluated"] as const;
  const counts = await limiter.counter.readMany(tasks.flatMap((task) => taskEvents.map((event) => key(day, event, task.id))));
  const challenges = await limiter.counter.readMany(content.challenges.challenges.map((challenge) => key(day, "challenge_evaluated", challenge.id)));
  const challengeTotal = challenges.reduce((sum, value) => sum + value, 0);
  const [generated, customEvaluated, shared] = await limiter.counter.readMany(customEvents.map((event) => customKey(day, event)));

  const rows = tasks
    .map((task, index) => ({ task, started: counts[index * 3], submitted: counts[index * 3 + 1], evaluated: counts[index * 3 + 2] }))
    .filter((row) => row.started + row.submitted + row.evaluated > 0);
  if (rows.length === 0 && challengeTotal === 0 && generated + customEvaluated + shared === 0) return;

  const sum = (field: "started" | "submitted" | "evaluated") => rows.reduce((total, row) => total + row[field], 0);
  const date = new Date(`${day}T12:00:00Z`).toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric", year: "numeric" });
  const body = [
    `Anonymní počty za ${date}: kolik pokusů se začalo, odevzdalo a ohodnotilo. Bez identity a bez textů.`,
    "",
    "| Úkol | Začato | Odevzdáno | Ohodnoceno |",
    "|---|---|---|---|",
    ...rows.map((row) => `| ${row.task.title}: ${row.task.taskTitle} | ${row.started} | ${row.submitted} | ${row.evaluated} |`),
    `| **Celkem** | **${sum("started")}** | **${sum("submitted")}** | **${sum("evaluated")}** |`,
    "",
    `Ohodnocené výzvy: ${challengeTotal}.`,
    "",
    `Vlastní výzvy: vygenerováno ${generated}, ohodnoceno ${customEvaluated}, žádostí o sdílení ${shared}.`,
    "",
    "Velký rozdíl mezi „Začato“ a „Odevzdáno“ ukazuje, kde lidé odpadají. Po přečtení issue zavři.",
  ].join("\n");
  await issues.create({ title: `Statistika za ${date}`, body, labels: ["statistika"] });
}
