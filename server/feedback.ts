import { z } from "zod";
import { DimensionId } from "../src/roles/roleSchema.js";
import { badRequest, json, limitResponse, readJson } from "./http.js";
import type { RateLimiter } from "./rateLimit.js";
import { upstashTransaction } from "./upstash.js";

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
    };
export type FeedbackStore = { save(entry: FeedbackEntry): Promise<void> };

// The newest notes are kept; older ones fall off, so spam cannot fill the database.
const maxStoredNotes = 500;

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

export function memoryFeedbackStore(): FeedbackStore & { entries: FeedbackEntry[] } {
  const entries: FeedbackEntry[] = [];
  return {
    entries,
    async save(entry) {
      entries.unshift(entry);
    },
  };
}

export function upstashFeedbackStore(url: string, token: string): FeedbackStore {
  return {
    async save(entry) {
      await upstashTransaction(url, token, [
        ["LPUSH", "feedback", JSON.stringify(entry)],
        ["LTRIM", "feedback", "0", String(maxStoredNotes - 1)],
      ]);
    },
  };
}

export async function handleFeedback(
  request: Request,
  { feedback, limiter }: { feedback: FeedbackStore; limiter: RateLimiter },
): Promise<Response> {
  const body = await readJson(request, 10_000);
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
  return json({ ok: true });
}

function toEntry(body: unknown, at: string): FeedbackEntry | null {
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
