import { z } from "zod";

// Mirrors data/roles/*.json. A new role is only a new JSON file, so the schema
// is the contract: a typo in a config shows up as a readable error at start.

export const dimensionIds = ["framing", "decomposition", "verification", "iteration", "judgment"] as const;
export const DimensionId = z.enum(dimensionIds);
export type DimensionId = z.infer<typeof DimensionId>;

const nonEmpty = z.string().trim().min(1);

const DictionaryEntry = z.object({
  column: nonEmpty,
  meaning: nonEmpty,
});

const Material = z.object({
  id: nonEmpty,
  title: nonEmpty,
  file: nonEmpty,
  type: z.enum(["csv", "markdown"]),
  rows: z.number().int().positive().optional(),
  period: z.string().optional(),
  dictionary: z.array(DictionaryEntry).optional(),
});
export type Material = z.infer<typeof Material>;

const RubricDimension = z.object({
  id: DimensionId,
  name: nonEmpty,
  question: nonEmpty,
  anchors: z.object({ "1": nonEmpty, "2": nonEmpty, "3": nonEmpty, "4": nonEmpty }),
});

const Level = z.object({
  level: z.number().int().min(1).max(4),
  label: nonEmpty,
  minAverage: z.number().min(0).max(4),
  description: nonEmpty,
});

export const RoleConfig = z.object({
  id: nonEmpty,
  title: nonEmpty,
  context: nonEmpty,
  assistantContext: nonEmpty,
  timeLimitMinutes: z.number().positive(),
  brief: z.object({
    situation: nonEmpty,
    task: nonEmpty,
    deliverable: nonEmpty,
    howToWork: nonEmpty,
    dataNote: nonEmpty,
  }),
  materials: z.array(Material).min(1),
  // Exactly the five shared dimensions, each once; only the anchor texts differ per role.
  rubric: z
    .array(RubricDimension)
    .length(dimensionIds.length)
    .refine((rubric) => new Set(rubric.map((dimension) => dimension.id)).size === dimensionIds.length, {
      message: "Každá z pěti dimenzí musí být v rubrice právě jednou.",
    }),
  levels: z
    .array(Level)
    .min(1)
    .refine((levels) => levels.some((level) => level.minAverage === 0), {
      message: "Aspoň jedna úroveň musí mít minAverage 0, jinak by nízký průměr neměl úroveň.",
    }),
  capRule: z.object({
    description: nonEmpty,
    dimensions: z.array(DimensionId).min(1),
    ifScoreAtMost: z.number().int().min(1).max(4),
    maxLevel: z.number().int().min(1).max(4),
  }),
  microExercises: z.record(DimensionId, nonEmpty),
});
export type RoleConfig = z.infer<typeof RoleConfig>;
