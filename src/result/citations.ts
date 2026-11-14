import type { RoleConfig } from "../roles/roleSchema";
import type { EvidencePlace, StoredEvaluation } from "../evaluation/evaluationSchema";
import type { EvaluatorKey } from "../evaluation/evaluatorKeys";

// One quote from the evaluation, tied to what it supports. The result screen
// shows it in the dimension and highlights it in the transcript with this label in the margin.
export type Citation = {
  id: string;
  turn: EvidencePlace;
  quote: string;
  // Dimension name or trap title the quote belongs to.
  label: string;
  verified: boolean;
};

export function collectCitations(role: RoleConfig, evaluation: StoredEvaluation, key: EvaluatorKey | null): Citation[] {
  const { output } = evaluation;
  const fromDimensions = output.dimensions.flatMap((dimension, dimensionIndex) =>
    dimension.evidence.map((evidence, evidenceIndex) => ({
      id: `dimension-${dimension.id}-${evidenceIndex}`,
      turn: evidence.turn,
      quote: evidence.quote,
      label: role.rubric.find((rubricDimension) => rubricDimension.id === dimension.id)?.name ?? dimension.id,
      verified: evaluation.dimensionQuotesVerified[dimensionIndex]?.[evidenceIndex] ?? false,
    })),
  );
  const fromTraps = output.traps.flatMap((trap, trapIndex) =>
    trap.evidence.map((evidence, evidenceIndex) => ({
      id: `trap-${trap.id}-${evidenceIndex}`,
      turn: evidence.turn,
      quote: evidence.quote,
      label: key?.traps.find((keyTrap) => keyTrap.id === trap.id)?.title ?? trap.id,
      verified: evaluation.trapQuotesVerified[trapIndex]?.[evidenceIndex] ?? false,
    })),
  );
  return [...fromDimensions, ...fromTraps];
}
