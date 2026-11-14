import type { DimensionId, RoleConfig } from "../roles/roleSchema";
import type { ReviewerReview, TaskSession } from "../session/sessionSchema";
import { computeLevel } from "../evaluation/computeLevel";

// The downloadable result (docs/SPEC.md, sections 4.4 and M5): the whole record of the work,
// the AI evaluation with the code's quote checks, and the level the code computed.
// The reviewer's adjustments sit next to the original, never instead of it.

export function exportFilename(role: RoleConfig, session: TaskSession): string {
  const date = (session.submittedAt ?? new Date().toISOString()).slice(0, 10);
  return `role-lab-${role.id}-${date}.json`;
}

export function buildExport(role: RoleConfig, session: TaskSession, review: ReviewerReview | null): string {
  const evaluation = session.evaluation;
  const aiScores = evaluation
    ? (Object.fromEntries(evaluation.output.dimensions.map((dimension) => [dimension.id, dimension.score])) as Record<DimensionId, number>)
    : null;

  const exported = {
    exportFormat: "role-lab-result",
    exportVersion: 1,
    exportedAt: new Date().toISOString(),
    role: { id: role.id, title: role.title },
    startedAt: session.startedAt,
    submittedAt: session.submittedAt ?? null,
    transcript: session.transcript,
    submission: session.submission,
    reflection: session.reflection,
    aiEvaluation:
      evaluation && aiScores
        ? {
            evaluatedAt: evaluation.evaluatedAt,
            level: computeLevel(role, aiScores),
            output: evaluation.output,
            quoteChecks: {
              dimensions: evaluation.dimensionQuotesVerified,
              traps: evaluation.trapQuotesVerified,
            },
            codeReviewFlags: evaluation.codeReviewFlags,
          }
        : null,
    reviewerReview: review
      ? {
          updatedAt: review.updatedAt,
          scores: review.scores,
          note: review.note,
          level: computeLevel(role, review.scores),
        }
      : null,
  };
  return JSON.stringify(exported, null, 2);
}
