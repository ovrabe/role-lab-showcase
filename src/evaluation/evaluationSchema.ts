import { z } from "zod";
import { DimensionId } from "../roles/roleSchema.js";

// Output schema from docs/PROMPTS.md, section 2. Tolerant where the model's
// wording varies harmlessly (a turn number sent as "3"), strict on what the
// result screen and the level calculation rely on.

// "reflection" is not in the prompt's schema: the code assigns it when a quote labelled
// "submission" is really from the optional process comment (see validateEvaluation).
const EvidenceTurn = z.union([
  z.literal("submission"),
  z.literal("reflection"),
  z.number().int().positive(),
  z.string().regex(/^\d+$/).transform(Number),
]);

export type EvidencePlace = number | "submission" | "reflection";

/** Where a quote is from, in words for the person: "krok 3", "odevzdání", "komentář k postupu". */
export function describeEvidencePlace(place: EvidencePlace): string {
  if (place === "submission") return "odevzdání";
  if (place === "reflection") return "komentář k postupu";
  return `krok ${place}`;
}

export const Evidence = z.object({
  turn: EvidenceTurn,
  quote: z.string(),
});
export type Evidence = z.infer<typeof Evidence>;

export const DimensionEvaluation = z.object({
  id: DimensionId,
  score: z.number().int().min(1).max(4),
  rationale: z.string(),
  evidence: z.array(Evidence).default([]),
});

export const TrapEvaluation = z.object({
  id: z.string(),
  status: z.enum(["caught", "partial", "missed"]),
  evidence: z.array(Evidence).default([]),
  note: z.string().default(""),
});

export const EvaluatorOutput = z.object({
  dimensions: z.array(DimensionEvaluation),
  traps: z.array(TrapEvaluation).default([]),
  strengths: z.array(z.string()).default([]),
  nextSteps: z
    .array(
      z.object({
        dimension: DimensionId,
        title: z.string(),
        why: z.string(),
        exercise: z.string(),
      }),
    )
    .default([]),
  insufficientEvidence: z.array(DimensionId).default([]),
  humanReviewFlags: z.array(z.string()).default([]),
  confidence: z.enum(["low", "medium", "high"]),
  summary: z.string(),
});
export type EvaluatorOutput = z.infer<typeof EvaluatorOutput>;

// What the page stores after validation: the model's output plus what the code checked.
export const StoredEvaluation = z.object({
  output: EvaluatorOutput,
  // Parallel to output.dimensions[i].evidence and output.traps[i].evidence.
  dimensionQuotesVerified: z.array(z.array(z.boolean())),
  trapQuotesVerified: z.array(z.array(z.boolean())),
  // Flags added by the code (unverified quotes, missing traps); shown with the model's own flags.
  codeReviewFlags: z.array(z.string()),
  evaluatedAt: z.string(),
  // Web build only: what each data trap was, sent by the server after submission for the
  // result screen (the page itself has no evaluator key). The claude.ai builds read the
  // key bundled in the page instead and leave this out.
  keyTraps: z
    .array(z.object({ id: z.string(), title: z.string(), whatIsWrong: z.string(), naiveEffect: z.string().optional() }))
    .optional(),
  // Web build only: the server's proof that this task was evaluated, which unlocks the strong
  // sample (/api/example). The sample shows the traps, so it is not given out before.
  exampleToken: z.string().max(64).optional(),
});
export type StoredEvaluation = z.infer<typeof StoredEvaluation>;
