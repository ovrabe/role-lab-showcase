import { notify } from "./notify.js";
import { z } from "zod";
import { DimensionId } from "../src/roles/roleSchema.js";
import { badRequest, json, limitResponse, readJson } from "./http.js";
import type { RateLimiter } from "./rateLimit.js";
import { upstashTransaction } from "./upstash.js";
import type { IssueTracker } from "./issues.js";
import { issueFromFeedback } from "./feedbackIssues.js";

/**
 * "Share feedback" (docs/PRODUCTION.md, step 5): a short note for the author, optionally with
 * a way to reply. Stored in the same Upstash database as the limit counters; the author reads
 * it in Vercel under Storage → role-lab-limits → Browser, key "feedback".
 * No IP address and nothing from the task is stored, only what the person wrote.
 */
export type FeedbackEntry =
  | { kind: "note"; message: string; contact?: string; page?: string; at: string }
  | {
      kind: "evaluation";
      rating: Rating;
      disagree: DimensionId[];
      comment?: string;
      roleId: string;
      level: number;
      scores: Partial<Record<DimensionId, number>>;
      at: string;
    }
  // The tester scenario (?testovani): every question with its answer, grouped by step.
  | { kind: "tester"; answers: TesterAnswer[]; contact?: string; at: string };
export type TesterAnswer = { step: string; question: string; answer: string };
export type FeedbackStore = {
  save(entry: FeedbackEntry): Promise<void>;
  // The newest entries first, for the admin page (server/adminHandler.ts).
  recent(limit: number): Promise<FeedbackEntry[]>;
  // Deletes notes older than 90 days. After every new note, and every morning from the cron
  // (server/morningHandler.ts), so they go on time even when no new note comes.
  prune(): Promise<void>;
};

// The newest notes are kept; older ones fall off, so spam cannot fill the database.
const maxStoredNotes = 500;
// Notes and the e-mail addresses in them are kept 90 days, as the forms promise, then deleted.
export const feedbackLifetimeDays = 90;
const isFresh = (entry: FeedbackEntry, now: Date) => now.getTime() - new Date(entry.at).getTime() < feedbackLifetimeDays * 24 * 60 * 60 * 1000;

const Rating = z.enum(["yes", "rather_yes", "rather_no", "no"]);
type Rating = z.infer<typeof Rating>;

const NoteRequest = z.object({
  message: z.string().trim().min(1).max(2_000),
  contact: z.string().trim().max(200).optional(),
  // Which screen it was sent from, e.g. "result" or "home", to give the note context.
  page: z.string().max(40).optional(),
});

// "Odpovídá hodnocení tvé práci?" on the result (docs/PRODUCTION.md, part 10, phase 1).
// Only the scores and the person's view of them; the conversation stays in the browser.
const EvaluationRequest = z.object({
  kind: z.literal("evaluation"),
  rating: Rating,
  disagree: z.array(DimensionId).max(5).default([]),
  comment: z.string().trim().max(2_000).optional(),
  roleId: z.string().max(60),
  level: z.number().int().min(1).max(4),
  scores: z.partialRecord(DimensionId, z.number().int().min(1).max(4)),
});

// A tester report: up to 40 answered questions. The question texts come from the page, so the
// report stays readable even when the scenario changes; lengths are capped against abuse.
const TesterRequest = z.object({
  kind: z.literal("tester"),
  answers: z
    .array(z.object({ step: z.string().trim().min(1).max(80), question: z.string().trim().min(1).max(300), answer: z.string().trim().min(1).max(2_000) }))
    .min(1)
    .max(40),
  contact: z.string().trim().max(200).optional(),
});

export function memoryFeedbackStore(): FeedbackStore & { entries: FeedbackEntry[] } {
  const entries: FeedbackEntry[] = [];
  const prune = async () => {
    const now = new Date();
    entries.splice(0, entries.length, ...entries.filter((item) => isFresh(item, now)));
  };
  return {
    entries,
    async save(entry) {
      entries.unshift(entry);
      await prune();
    },
    async recent(limit) {
      const now = new Date();
      return entries.filter((item) => isFresh(item, now)).slice(0, limit);
    },
    prune,
  };
}

function parseEntry(value: string): FeedbackEntry | null {
  try {
    return JSON.parse(value) as FeedbackEntry;
  } catch {
    return null;
  }
}

// How many of the oldest notes one round of pruning looks at; a few rounds cover the list.
const pruneWindow = 20;

export function upstashFeedbackStore(url: string, token: string): FeedbackStore {
  // Deletes from the old end only, value by value (LREM). New notes go to the other end, so a
  // note arriving meanwhile cannot shift what gets deleted. Cutting by position (the first
  // version) could delete a fresh note when two came at once (review of 24. 11. 2026).
  async function prune() {
    const now = new Date();
    for (let round = 0; round * pruneWindow < maxStoredNotes; round++) {
      const [values] = await upstashTransaction(url, token, [["LRANGE", "feedback", String(-pruneWindow), "-1"]]);
      const oldestLast = ((values ?? []) as string[]).slice().reverse();
      const expired: string[] = [];
      for (const value of oldestLast) {
        const entry = parseEntry(value);
        // An unreadable entry is junk and goes too; the first fresh one ends the search.
        if (entry && isFresh(entry, now)) break;
        expired.push(value);
      }
      if (expired.length === 0) return;
      await upstashTransaction(url, token, expired.map((value) => ["LREM", "feedback", "-1", value]));
      if (expired.length < oldestLast.length) return;
    }
  }
  return {
    async save(entry) {
      await upstashTransaction(url, token, [
        ["LPUSH", "feedback", JSON.stringify(entry)],
        ["LTRIM", "feedback", "0", String(maxStoredNotes - 1)],
        // With no new note for 90 days, the whole list goes.
        ["EXPIRE", "feedback", String(feedbackLifetimeDays * 24 * 60 * 60)],
      ]);
      // The note is stored: a failed cleanup must not report it as lost (the person would send
      // it again). The morning cron prunes anyway.
      try {
        await prune();
      } catch (error) {
        console.error("Pruning old feedback failed:", error);
      }
    },
    async recent(limit) {
      const [values] = await upstashTransaction(url, token, [["LRANGE", "feedback", "0", String(limit - 1)]]);
      const now = new Date();
      return ((values ?? []) as string[]).map(parseEntry).filter((item): item is FeedbackEntry => item !== null && isFresh(item, now));
    },
    prune,
  };
}

export async function handleFeedback(
  request: Request,
  { feedback, limiter, issues = null }: { feedback: FeedbackStore; limiter: RateLimiter; issues?: IssueTracker | null },
): Promise<Response> {
  // Room for a full tester report (40 answers); a single note stays far below.
  const body = await readJson(request, 100_000);
  if (body instanceof Response) return body;
  const entry = toEntry(body, new Date().toISOString());
  if (!entry) return badRequest("invalid_request", "Invalid feedback.");
  const limited = await limitResponse(limiter, "feedback", request);
  if (limited) return limited;

  try {
    await feedback.save(entry);
  } catch (error) {
    console.error("Saving feedback failed:", error);
    return badRequest("upstream_error", "Feedback could not be saved.", 503);
  }
  // Only the kind: the text and any contact stay in the admin, never in Slack.
  const kindName = { note: "vzkaz", evaluation: "hodnocení výsledku", tester: "odpovědi testera" }[entry.kind];
  await notify(limiter, "feedback", `:speech_balloon: Nová zpětná vazba: ${kindName}.`);
  // The backlog copy is a convenience: the note is already saved, so a GitHub outage is only logged.
  const issue = issueFromFeedback(entry);
  if (issues && issue) {
    try {
      await issues.create(issue);
    } catch (error) {
      console.error("Creating the backlog issue failed:", error);
    }
  }
  return json({ ok: true });
}

function toEntry(body: unknown, at: string): FeedbackEntry | null {
  const tester = TesterRequest.safeParse(body);
  if (tester.success) {
    const { answers, contact } = tester.data;
    return { kind: "tester", answers, ...(contact ? { contact } : {}), at };
  }
  const evaluation = EvaluationRequest.safeParse(body);
  if (evaluation.success) {
    const { comment, ...rest } = evaluation.data;
    return { ...rest, ...(comment ? { comment } : {}), at };
  }
  const note = NoteRequest.safeParse(body);
  if (!note.success) return null;
  const { message, contact, page } = note.data;
  return { kind: "note", message, ...(contact ? { contact } : {}), ...(page ? { page } : {}), at };
}
