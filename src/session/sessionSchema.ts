import { z } from "zod";
import { StoredEvaluation } from "../evaluation/evaluationSchema.js";
import { DimensionId } from "../roles/roleSchema.js";

// Shape from docs/SPEC.md, section 6.
export const TranscriptEvent = z.enum([
  "task_opened",
  "material_viewed",
  "material_downloaded",
  "data_attached",
  "submission_saved",
  "submitted",
]);
export type TranscriptEvent = z.infer<typeof TranscriptEvent>;

export const TranscriptItem = z.object({
  turn: z.number().int().positive(),
  kind: z.enum(["user", "assistant", "event"]),
  content: z.string(),
  event: TranscriptEvent.optional(),
  materialId: z.string().optional(),
  ts: z.string(),
});
export type TranscriptItem = z.infer<typeof TranscriptItem>;

export const ReviewerReview = z.object({
  scores: z.record(DimensionId, z.number().int().min(1).max(4)),
  note: z.string(),
  updatedAt: z.string(),
});
export type ReviewerReview = z.infer<typeof ReviewerReview>;

// Everything one person's attempt at one role needs to survive a page reload.
export const TaskSession = z.object({
  version: z.literal(1),
  roleId: z.string(),
  startedAt: z.string(),
  transcript: z.array(TranscriptItem),
  submission: z.string(),
  reflection: z.string(),
  // Submission text at the last submission_saved event, to log only real changes.
  lastSavedSubmission: z.string(),
  // Set once the person submits; from then on the task is locked (only "Začít znovu").
  submittedAt: z.string().optional(),
  evaluation: StoredEvaluation.optional(),
  // A human reviewer's adjustments (docs/SPEC.md, section 4.5). Kept next to the AI evaluation,
  // which is never overwritten, so the export can show both.
  review: ReviewerReview.optional(),
});
export type TaskSession = z.infer<typeof TaskSession>;
