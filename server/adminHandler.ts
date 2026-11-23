import { notify } from "./notify.js";
import { adminAskInstructions, buildAdminAskMessage, cleanAdminAnswer, maxQuestionChars } from "../src/prompts/adminAsk.js";
import { askData } from "../src/admin/askContext.js";
import type { AdminOverview as AskOverview } from "../src/admin/adminApi.js";
import type { ClaudeClient } from "./claudeClient.js";
import { measureCall } from "./metrics.js";
import { asClaudeError, parseJsonReply } from "./handlers.js";
import { digest } from "../src/admin/digest.js";
import { buildAdminSummaryPrompt, validateAdminSummary, type AdminSummary } from "../src/prompts/adminSummary.js";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { badRequest, json, readJson } from "./http.js";
import { dailyLimits, type RateLimiter } from "./rateLimit.js";
import { dailyBudgetUsd } from "./spendBudget.js";
import { pragueDay, type MetricEntries } from "./metrics.js";
import { publicPart } from "../src/customTask/generatedTask.js";
import type { ServerContent } from "./content.js";
import type { FeedbackEntry, FeedbackStore } from "./feedback.js";
import type { CustomTaskStore } from "./customTaskStore.js";
import type { IssueTracker } from "./issues.js";
import { upstashTransaction } from "./upstash.js";

/**
 * POST /api/admin (docs/PRODUCTION.md, part 11): the author's overview and a few actions,
 * behind one long secret token (ADMIN_TOKEN in the Vercel settings, never in code).
 *
 * - No token configured, or one shorter than 32 characters: the endpoint does not exist (404).
 * - The token is compared in constant time, so the response time tells nothing about it.
 * - At most 10 wrong tokens per address and day; the first one of a day files an issue.
 * - Only the project's own page may call it (readJson checks the origin).
 * - It returns daily totals and the author's own backlog; nothing identifies a visitor.
 * Every action goes into a short log (time and action, no address).
 */

export const minTokenLength = 32;
const maxFailuresPerDay = 10;
const maxDays = 90;

const AdminRequest = z.discriminatedUnion("action", [
  z.object({ action: z.literal("overview"), days: z.number().int().min(1).max(maxDays).default(30) }),
  z.object({ action: z.literal("decide_share"), id: z.string().regex(/^[A-Za-z0-9_-]{12}$/), decision: z.enum(["approved", "rejected"]) }),
  z.object({ action: z.literal("generation"), off: z.boolean() }),
  // The AI summary of the period; cached for the day, refresh asks for a new one.
  z.object({ action: z.literal("summary"), days: z.number().int().min(1).max(maxDays).default(30), refresh: z.boolean().default(false) }),
  // "Zeptat se na data": a question in the author's own words about the same totals.
  z.object({ action: z.literal("ask"), days: z.number().int().min(1).max(maxDays).default(30), question: z.string().trim().min(3).max(maxQuestionChars) }),
]);

// The author's AI calls (summaries and questions) together: plenty for one person, a ceiling for
// a leaked token. They are measured in the metrics (their own lines in "Modely a útrata") but
// kept out of the testers' daily budget (spendBudget.ts), so the author's evening of questions
// can never use up the money the testers' attempts need.
const maxAiCallsPerDay = 50;

/** Counts one AI call of the admin; false when today's ceiling is reached. */
async function takeAiCall(limiter: RateLimiter, now: Date): Promise<boolean> {
  if (!limiter.counter.add) return true;
  return (await limiter.counter.add(`admin:ai:${pragueDay(now)}`, 1)) <= maxAiCallsPerDay;
}

export type AdminDeps = {
  content: ServerContent;
  limiter: RateLimiter;
  feedback: FeedbackStore;
  customTasks: CustomTaskStore;
  issues?: IssueTracker | null;
  // Read from the environment by api/admin.ts; passed in so tests can set it.
  adminToken: string | undefined;
  // Where the action log lives; without it the log is kept in memory (tests).
  adminLog?: AdminLog;
  // Writes the AI summary (claude.evaluateChallenge = the quick model) and keeps it for a day.
  claude?: Partial<Pick<ClaudeClient, "evaluateChallenge" | "chat">>;
  summaryCache?: SummaryCache;
};

export type SummaryCache = { get(key: string): Promise<string | null>; set(key: string, value: string): Promise<void> };

export function memorySummaryCache(): SummaryCache {
  const values = new Map<string, string>();
  return {
    async get(key) {
      return values.get(key) ?? null;
    },
    async set(key, value) {
      values.set(key, value);
    },
  };
}

export function upstashSummaryCache(url: string, token: string): SummaryCache {
  return {
    async get(key) {
      const [value] = await upstashTransaction(url, token, [["GET", key]]);
      return typeof value === "string" ? value : null;
    },
    async set(key, value) {
      await upstashTransaction(url, token, [["SET", key, value, "EX", String(24 * 60 * 60)]]);
    },
  };
}

export type AdminLog = { add(entry: { at: string; action: string; detail?: string }): Promise<void>; recent(limit: number): Promise<{ at: string; action: string; detail?: string }[]> };

export function memoryAdminLog(): AdminLog {
  const entries: { at: string; action: string; detail?: string }[] = [];
  return {
    async add(entry) {
      entries.unshift(entry);
    },
    async recent(limit) {
      return entries.slice(0, limit);
    },
  };
}

export function upstashAdminLog(url: string, token: string): AdminLog {
  return {
    async add(entry) {
      await upstashTransaction(url, token, [
        ["LPUSH", "admin:log", JSON.stringify(entry)],
        ["LTRIM", "admin:log", "0", "199"],
        ["EXPIRE", "admin:log", String(90 * 24 * 60 * 60)],
      ]);
    },
    async recent(limit) {
      const [values] = await upstashTransaction(url, token, [["LRANGE", "admin:log", "0", String(limit - 1)]]);
      return ((values ?? []) as string[]).map((value) => JSON.parse(value));
    },
  };
}

// Equal length digests, so timingSafeEqual never throws and the length leaks nothing either.
function tokenMatches(given: string, expected: string): boolean {
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(given), digest(expected));
}

const addressMark = (request: Request, secret: string) => {
  const ip = request.headers.get("x-real-ip")?.trim() || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  return createHmac("sha256", secret).update(ip).digest("hex").slice(0, 16);
};

export async function handleAdmin(request: Request, deps: AdminDeps): Promise<Response> {
  const { limiter, adminToken } = deps;
  // Without a proper token the admin does not exist at all.
  if (!adminToken || adminToken.length < minTokenLength) return badRequest("not_found", "Not found.", 404);
  const body = await readJson(request, 2_000);
  if (body instanceof Response) return body;

  const now = (limiter.now ?? (() => new Date()))();
  const failKey = `admin:fail:${pragueDay(now)}:${addressMark(request, limiter.secret)}`;
  const given = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  try {
    // Checked before the token, so a blocked address learns nothing more.
    if (limiter.counter.add && (await limiter.counter.add(failKey, 0)) >= maxFailuresPerDay) return badRequest("too_many_attempts", "Too many attempts.", 429);
    if (!tokenMatches(given, adminToken)) {
      const failures = (await limiter.counter.add?.(failKey, 1)) ?? 1;
      if ((await limiter.counter.add?.(`alert:${pragueDay(now)}:admin_login`, 1)) === 1) await alertFailedLogin(deps, failures);
      await notify(limiter, "admin_login", `:lock: Neúspěšné přihlášení do adminu (${failures}. pokus z jedné adresy dnes).`);
      return badRequest("unauthorized", "Wrong token.", 401);
    }
  } catch (error) {
    console.error("Admin check failed:", error);
    return badRequest("service_unavailable", "Check unavailable.", 503);
  }

  const parsed = AdminRequest.safeParse(body);
  if (!parsed.success) return badRequest("invalid_request", "Invalid admin request.");
  const log = deps.adminLog ?? memoryAdminLog();
  const request_ = parsed.data;

  if (request_.action === "overview") return json(await overview(deps, log, request_.days, now));
  if (request_.action === "summary") return summary(request, deps, request_.days, request_.refresh, now);
  if (request_.action === "ask") return ask(request, deps, log, request_.days, request_.question, now);
  if (request_.action === "decide_share") {
    const record = await deps.customTasks.decideShare(request_.id, request_.decision, now.toISOString());
    if (!record) return badRequest("not_found", "Task not found or expired.", 404);
    await log.add({ at: now.toISOString(), action: request_.decision === "approved" ? "share_approved" : "share_rejected", detail: request_.id });
    return json({ ok: true });
  }
  await deps.customTasks.setGenerationOff(request_.off);
  await log.add({ at: now.toISOString(), action: request_.off ? "generation_off" : "generation_on" });
  return json({ ok: true });
}

async function alertFailedLogin({ issues }: AdminDeps, failures: number) {
  if (!issues) return;
  try {
    await issues.create({
      title: "Admin: neúspěšné přihlášení",
      body: [
        `Dnes přišel požadavek na admin se špatným tokenem (${failures}. z jedné adresy).`,
        "",
        `Po ${maxFailuresPerDay} pokusech za den server další z té adresy odmítá. Když to nejsi ty, zvaž vygenerovat nový ADMIN_TOKEN ve Vercelu.`,
        "",
        "Tohle issue vzniká nejvýš jednou denně. Po přečtení ho zavři.",
      ].join("\n"),
      labels: ["provoz"],
    });
  } catch (error) {
    console.error("Filing the admin alert failed:", error);
  }
}

export type AdminOverview = {
  generatedAt: string;
  days: { day: string; metrics: MetricEntries; visitors: number }[];
  // The same number of days just before, for the trends on the overview.
  previousDays: { day: string; metrics: MetricEntries; visitors: number }[];
  // Whether Slack notifications and the morning message are set up in the Vercel settings.
  notifications: { slack: boolean; morning: boolean };
  budget: { perIpUsd: number; totalUsd: number; spentTodayUsd: number };
  limits: typeof dailyLimits;
  tasks: { id: string; roleTitle: string; taskTitle: string; difficulty: number }[];
  pendingShares: { id: string; title: string; roleTitle: string; requestedAt: string; brief: { situation: string; task: string }; trap: string }[];
  generationOff: boolean;
  feedback: FeedbackEntry[];
  log: { at: string; action: string; detail?: string }[];
};

export async function overview(deps: AdminDeps, log: AdminLog, dayCount: number, now: Date): Promise<AdminOverview> {
  const { limiter, content } = deps;
  const perDay = await readDays(limiter, dayCount, 0, now);
  const previousDays = await readDays(limiter, dayCount, dayCount, now);
  const spentToday = limiter.counter.add ? (await limiter.counter.add(`spend:${pragueDay(now)}:total`, 0)) / 1_000_000 : 0;
  const pending = await deps.customTasks.listPending();
  return {
    generatedAt: now.toISOString(),
    days: perDay,
    previousDays,
    notifications: { slack: Boolean(limiter.notifier), morning: (process.env.CRON_SECRET?.trim().length ?? 0) >= 16 },
    budget: { perIpUsd: dailyBudgetUsd.perIp, totalUsd: dailyBudgetUsd.total, spentTodayUsd: spentToday },
    limits: limiter.limits ?? dailyLimits,
    tasks: content.roles.activeRoles.map((role) => ({ id: role.id, roleTitle: role.title, taskTitle: role.taskTitle, difficulty: role.difficulty })),
    // The trap is shown to the author, who decides whether the task is good enough to share.
    pendingShares: pending.map((record) => {
      const visible = publicPart(record.task);
      return {
        id: record.id,
        title: visible.title,
        roleTitle: visible.roleTitle,
        requestedAt: record.share?.requestedAt ?? "",
        brief: { situation: visible.brief.situation, task: visible.brief.task },
        trap: record.task.trap.whatIsWrong,
      };
    }),
    generationOff: await deps.customTasks.isGenerationOff(),
    feedback: await deps.feedback.recent(50),
    log: await log.recent(30),
  };
}

const dayMs = 24 * 60 * 60 * 1000;

/** dayCount days ending skip days before today, newest first. Metrics older than 90 days are gone. */
export async function readDays(limiter: RateLimiter, dayCount: number, skip: number, now: Date) {
  const metrics = limiter.metrics;
  const days = Array.from({ length: dayCount }, (_, index) => pragueDay(new Date(now.getTime() - (index + skip) * dayMs)));
  return Promise.all(
    days.map(async (day) => ({
      day,
      metrics: metrics ? await metrics.readDay(day) : {},
      visitors: metrics ? await metrics.countUnique(day, "visitors") : 0,
    })),
  );
}

export type SummaryOutcome = { ok: true; summary: AdminSummary; cached: boolean } | { ok: false; code: string; status: number };

/** The AI summary of the last dayCount days: from today's cache, or newly written by the quick model. */
export async function writeSummary(deps: AdminDeps, dayCount: number, refresh: boolean, now: Date, signal?: AbortSignal): Promise<SummaryOutcome> {
  const { limiter, claude } = deps;
  const cache = deps.summaryCache ?? memorySummaryCache();
  const key = `admin:summary:${pragueDay(now)}:${dayCount}`;
  if (!refresh) {
    const cached = await cache.get(key);
    if (cached) return { ok: true, summary: JSON.parse(cached) as AdminSummary, cached: true };
  }
  if (!claude?.evaluateChallenge) return { ok: false, code: "unavailable", status: 503 };
  // Only a new summary counts; a cached one costs nothing.
  if (!(await takeAiCall(limiter, now))) return { ok: false, code: "limit_daily", status: 429 };
  const current = await readDays(limiter, dayCount, 0, now);
  const previous = await readDays(limiter, dayCount, dayCount, now);
  const prompt = buildAdminSummaryPrompt(current.at(-1)!.day, current[0].day, digest(current), digest(previous));
  const call = measureCall(limiter.metrics, "adminSummary");
  try {
    const reply = await claude.evaluateChallenge(prompt, { signal: signal ?? new AbortController().signal, onUsage: async (model, usage) => call.usage(model, usage) });
    const result = validateAdminSummary(parseJsonReply(reply));
    await call.finish(result ? "ok" : "invalid_json");
    if (!result) return { ok: false, code: "invalid_reply", status: 502 };
    await cache.set(key, JSON.stringify(result));
    return { ok: true, summary: result, cached: false };
  } catch (error) {
    const failure = asClaudeError(error);
    await call.finish(failure.code);
    return { ok: false, code: failure.code, status: 502 };
  }
}

async function summary(request: Request, deps: AdminDeps, dayCount: number, refresh: boolean, now: Date): Promise<Response> {
  const outcome = await writeSummary(deps, dayCount, refresh, now, request.signal);
  return outcome.ok ? json({ ...outcome.summary, cached: outcome.cached }) : badRequest(outcome.code, "The summary could not be written.", outcome.status);
}

async function ask(request: Request, deps: AdminDeps, log: AdminLog, dayCount: number, question: string, now: Date): Promise<Response> {
  const { limiter, claude } = deps;
  if (!claude?.chat) return badRequest("unavailable", "Questions are not available.", 503);
  if (!(await takeAiCall(limiter, now))) return badRequest("limit_daily", "Too many AI calls today.", 429);
  const data = await overview(deps, log, dayCount, now);
  const message = buildAdminAskMessage(question, data.days.at(-1)!.day, data.days[0].day, dayCount, askData(data as unknown as AskOverview));
  const call = measureCall(limiter.metrics, "adminAsk");
  let answer = "";
  try {
    await claude.chat([{ role: "user", content: `${adminAskInstructions}\n\n${message}` }], {
      signal: request.signal,
      onDelta: (text) => (answer += text),
      onUsage: async (model, usage) => call.usage(model, usage),
    });
  } catch (error) {
    const failure = asClaudeError(error);
    await call.finish(failure.code);
    return badRequest(failure.code, "The question could not be answered.", 502);
  }
  const clean = cleanAdminAnswer(answer);
  await call.finish(clean ? "ok" : "empty_completion");
  return clean ? json({ answer: clean }) : badRequest("invalid_reply", "Empty answer.", 502);
}
