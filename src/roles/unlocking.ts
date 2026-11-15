import type { RoleConfig } from "./roleSchema";
import type { ProgressAttempt } from "../progress/progress";

/**
 * Which tasks are open (docs/PRODUCTION.md, part 10, phase 3). Difficulty 1 and 2 are always
 * open, so anyone can start and the original tasks stay available for demos. Difficulty 3
 * opens once the person reaches overall level 3 in a difficulty-2 task of the same role.
 */
export const unlockingLevel = 3;

export type TaskLock = { unlocked: true } | { unlocked: false; reason: string };

export function taskLock(task: RoleConfig, tasksOfRole: RoleConfig[], attempts: ProgressAttempt[]): TaskLock {
  if (task.difficulty < 3) return { unlocked: true };
  // Saved attempts name the task in the field "roleId" (see src/roles/taskRoles.ts).
  if (attempts.some((attempt) => attempt.roleId === task.id)) return { unlocked: true };

  const gates = tasksOfRole.filter((candidate) => candidate.difficulty === 2);
  const gateIds = new Set(gates.map((gate) => gate.id));
  if (attempts.some((attempt) => gateIds.has(attempt.roleId) && attempt.level >= unlockingLevel)) return { unlocked: true };

  const levelLabel = task.levels.find((level) => level.level === unlockingLevel)?.label;
  const level = levelLabel ? `úrovně ${unlockingLevel} (${levelLabel})` : `úrovně ${unlockingLevel}`;
  const gateName = gates.length === 1 ? `v úkolu „${gates[0].taskTitle}“` : "v úkolu obtížnosti 2";
  return { unlocked: false, reason: `Odemkne se, až ${gateName} dosáhneš ${level}.` };
}

/** Names for the three difficulties, shown on the task cards. */
export const difficultyNames: Record<number, string> = { 1: "Základní", 2: "Střední", 3: "Pokročilá" };
