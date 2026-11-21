import { readItem, writeItem } from "../session/sessionStorage";
import { RoleDefinition, type RoleConfig } from "../roles/roleSchema";
import { registerMaterialTexts } from "../materials/materialFiles";
import { GeneratedTask, type PublicGeneratedTask } from "./generatedTask";
import { composeCustomTask, customMaterialTexts, customTaskConfigId, customTaskIdOf } from "./customTaskRole";

// The last generated custom task, kept in this browser so it can be solved after a reload.
// Only the public part: the trap stays on the server. One task a day, so one slot is enough.

const storageKey = "role-lab:custom-task";
const PublicTask = GeneratedTask.omit({ trap: true, judgmentMarkers: true, facts: true });

export type SavedCustomTask = { id: string; task: PublicGeneratedTask };

const roleFile = Object.values(import.meta.glob("../../data/custom-task/role.json", { eager: true, import: "default" }))[0];
const customRole = RoleDefinition.parse(roleFile);

export function saveCustomTask(saved: SavedCustomTask): void {
  writeItem(storageKey, JSON.stringify(saved));
}

export function loadCustomTask(): SavedCustomTask | null {
  const raw = readItem(storageKey);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { id?: unknown; task?: unknown };
    const task = PublicTask.safeParse(parsed.task);
    return typeof parsed.id === "string" && task.success ? { id: parsed.id, task: task.data } : null;
  } catch {
    return null;
  }
}

/** The saved task as a RoleConfig for the task screen, with its materials ready to show. */
export function savedCustomRole(configId: string): RoleConfig | null {
  const saved = loadCustomTask();
  if (!saved || customTaskIdOf(configId) !== saved.id) return null;
  registerMaterialTexts(customMaterialTexts(saved.id, saved.task));
  return composeCustomTask(customRole, saved.id, saved.task);
}

export const savedCustomConfigId = (saved: SavedCustomTask) => customTaskConfigId(saved.id);
