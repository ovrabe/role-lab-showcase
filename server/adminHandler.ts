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
]);

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
};

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
  budget: { perIpUsd: number; totalUsd: number; spentTodayUsd: number };
  limits: typeof dailyLimits;
  tasks: { id: string; roleTitle: string; taskTitle: string; difficulty: number }[];
  pendingShares: { id: string; title: string; roleTitle: string; requestedAt: string; brief: { situation: string; task: string }; trap: string }[];
  generationOff: boolean;
  feedback: FeedbackEntry[];
  log: { at: string; action: string; detail?: string }[];
};

async function overview(deps: AdminDeps, log: AdminLog, dayCount: number, now: Date): Promise<AdminOverview> {
  const { limiter, content } = deps;
  const days = Array.from({ length: dayCount }, (_, index) => pragueDay(new Date(now.getTime() - index * 24 * 60 * 60 * 1000)));
  const metrics = limiter.metrics;
  const perDay = await Promise.all(
    days.map(async (day) => ({
      day,
      metrics: metrics ? await metrics.readDay(day) : {},
      visitors: metrics ? await metrics.countUnique(day, "visitors") : 0,
    })),
  );
  const spentToday = limiter.counter.add ? (await limiter.counter.add(`spend:${pragueDay(now)}:total`, 0)) / 1_000_000 : 0;
  const pending = await deps.customTasks.listPending();
  return {
    generatedAt: now.toISOString(),
    days: perDay,
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
