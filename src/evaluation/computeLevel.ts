import type { DimensionId, RoleConfig } from "../roles/roleSchema";

export type LevelResult = {
  average: number;
  level: number;
  label: string;
  description: string;
  // The level the average alone would give; differs from `level` when the cap applied.
  levelBeforeCap: number;
  capApplied: boolean;
  capReason: string | null;
};

/**
 * The overall level is computed here, never by the model (docs/PROMPTS.md, section 3):
 * 1. average of the five scores, 2. level by levels[].minAverage, 3. cap rule.
 * The evaluator mode (M5) reuses this function after manual score changes.
 */
export function computeLevel(role: RoleConfig, scores: Record<DimensionId, number>): LevelResult {
  const values = role.rubric.map((dimension) => scores[dimension.id]);
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;

  // Highest level whose threshold the average reaches. A tiny tolerance keeps
  // a float like 2.4999999 from missing the 2.5 threshold.
  const levelsByThreshold = [...role.levels].sort((a, b) => a.minAverage - b.minAverage);
  const reached = levelsByThreshold.filter((level) => average + 1e-9 >= level.minAverage);
  const byAverage = reached[reached.length - 1] ?? levelsByThreshold[0];

  const { capRule } = role;
  const cappingDimensions = role.rubric.filter(
    (dimension) => capRule.dimensions.includes(dimension.id) && scores[dimension.id] <= capRule.ifScoreAtMost,
  );
  const capApplied = cappingDimensions.length > 0 && byAverage.level > capRule.maxLevel;
  const finalLevel = capApplied
    ? (role.levels.find((level) => level.level === capRule.maxLevel) ?? byAverage)
    : byAverage;

  return {
    average,
    level: finalLevel.level,
    label: finalLevel.label,
    description: finalLevel.description,
    levelBeforeCap: byAverage.level,
    capApplied,
    capReason: capApplied
      ? `${cappingDimensions.map((dimension) => dimension.name).join(" a ")} na úrovni ${capRule.ifScoreAtMost}. ${capRule.description}`
      : null,
  };
}
