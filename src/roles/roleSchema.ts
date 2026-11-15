import { z } from "zod";

// Mirrors data/roles/*.json and data/tasks/*.json. A new role or task is only a new JSON file, so the schema
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

/** What every task of a role shares (data/roles/<role>.json): who the person is and how work is judged. */
export const RoleDefinition = z.object({
  id: nonEmpty,
  title: nonEmpty,
  context: nonEmpty,
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
export type RoleDefinition = z.infer<typeof RoleDefinition>;

/** One task of a role (data/tasks/<task>.json): its situation, materials and difficulty. */
export const TaskDefinition = z.object({
  // The first task of each role keeps the role's id, so attempts saved before roles had
  // several tasks (sessions, progress, evaluator keys, samples) still belong to it.
  id: nonEmpty,
  roleId: nonEmpty,
  title: nonEmpty,
  difficulty: z.number().int().min(1).max(3),
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
});
export type TaskDefinition = z.infer<typeof TaskDefinition>;

/**
 * A task together with the shared parts of its role: what the rest of the app works with.
 * `id` is the task's id; `title` and `context` stay the role's, the task's own name is `taskTitle`.
 */
export type RoleConfig = Omit<RoleDefinition, "id"> &
  Omit<TaskDefinition, "id" | "title" | "roleId"> & { id: string; roleId: string; taskTitle: string };

export function composeTask(role: RoleDefinition, task: TaskDefinition): RoleConfig {
  const { id: _roleId, ...shared } = role;
  const { id, title, roleId, ...own } = task;
  return { ...shared, ...own, id, roleId, taskTitle: title };
}
