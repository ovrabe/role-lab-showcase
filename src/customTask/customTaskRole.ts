import { composeTask, RoleDefinition, type RoleConfig } from "../roles/roleSchema.js";
import type { EvaluatorKey } from "../evaluation/evaluatorKeySchema.js";
import { parseSimpleCsv, type GeneratedTask, type PublicGeneratedTask } from "./generatedTask.js";

/**
 * A generated custom task (docs/SPEC.md, section 14) as the rest of the app sees a task: a
 * RoleConfig with the generic rubric (data/custom-task/role.json), two materials and, on the
 * server only, an evaluator key. The same functions run in the page and on the server, so
 * both build the same prompts from the same task.
 */

export const customRoleId = "custom-task";
const idPrefix = "custom-";

export const isCustomTask = (role: { roleId: string }) => role.roleId === customRoleId;
export const customTaskConfigId = (customTaskId: string) => `${idPrefix}${customTaskId}`;
export const customTaskIdOf = (configId: string) => (configId.startsWith(idPrefix) ? configId.slice(idPrefix.length) : null);

// Paths outside data/, so they can never collide with a real material file.
const tableFile = (customTaskId: string) => `custom-task/${customTaskId}/tabulka.csv`;
const notesFile = (customTaskId: string) => `custom-task/${customTaskId}/poznamky.md`;

/** Parses the generic rubric; throws on a broken file, which tests catch before release. */
export function parseCustomRole(content: unknown): RoleDefinition {
  return RoleDefinition.parse(content);
}

export function composeCustomTask(definition: RoleDefinition, customTaskId: string, task: PublicGeneratedTask): RoleConfig {
  const rows = parseSimpleCsv(task.table.csv).length - 1;
  const role = composeTask(definition, {
    id: customTaskConfigId(customTaskId),
    roleId: customRoleId,
    title: task.title,
    difficulty: 1,
    assistantContext: `lidé v roli „${task.roleTitle}“`,
    timeLimitMinutes: 15,
    brief: {
      ...task.brief,
      howToWork: "Můžeš používat AI asistenta. Pracuj s ním jako v běžný den. Hodnotíme výsledek i to, jak s asistentem pracuješ.",
      dataNote: "Podklady najdeš v záložce Podklady. Do konverzace je můžeš přiložit tlačítkem, vložit jejich část, nebo je nepoužít vůbec.",
    },
    materials: [
      {
        id: "tabulka",
        title: task.table.title,
        file: tableFile(customTaskId),
        type: "csv",
        rows,
        period: task.table.period,
        dictionary: task.table.columns.map((column) => ({ column: column.name, meaning: column.meaning })),
      },
      { id: "poznamky", title: task.notes.title, file: notesFile(customTaskId), type: "markdown" },
    ],
  });
  // The person's own role, not the generic "Vlastní výzva", is what the task is about.
  return { ...role, title: task.roleTitle, context: task.roleContext };
}

/** The text of the two materials, keyed by the paths composeCustomTask gives them. */
export function customMaterialTexts(customTaskId: string, task: PublicGeneratedTask): Map<string, string> {
  return new Map([
    [tableFile(customTaskId), task.table.csv.trim() + "\n"],
    [notesFile(customTaskId), task.notes.markdown.trim() + "\n"],
  ]);
}

/** The evaluator key in the shape of evaluator-data/*.key.json. Server only: it holds the trap. */
export function customEvaluatorKey(customTaskId: string, task: GeneratedTask): EvaluatorKey {
  const { cell: _cell, ...trap } = task.trap;
  return {
    roleId: customTaskConfigId(customTaskId),
    traps: [{ id: "T1_past", ...trap }],
    judgmentMarkers: task.judgmentMarkers,
    facts: task.facts,
  };
}
