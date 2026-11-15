import { describe, expect, it } from "vitest";
import { taskLock } from "./unlocking";
import { loadRoles } from "./loadRoles";
import type { RoleConfig } from "./roleSchema";
import type { ProgressAttempt } from "../progress/progress";

// Built from the real level-2 task, so the test needs no private data and no new content.
const base = loadRoles().activeRoles.find((task) => task.id === "category-manager")!;
const easy: RoleConfig = { ...base, id: "cm-easy", taskTitle: "Lehký", difficulty: 1 };
const middle = base;
const hard: RoleConfig = { ...base, id: "cm-hard", taskTitle: "Těžký", difficulty: 3 };
const tasks = [easy, middle, hard];

const attempt = (taskId: string, level: number): ProgressAttempt => ({
  roleId: taskId,
  evaluatedAt: "2026-11-15T10:00:00.000Z",
  level,
  scores: { framing: level, decomposition: level, verification: level, iteration: level, judgment: level },
  traps: { caught: 0, total: 2 },
});

describe("taskLock", () => {
  it("keeps difficulty 1 and 2 open from the start", () => {
    expect(taskLock(easy, tasks, []).unlocked).toBe(true);
    expect(taskLock(middle, tasks, []).unlocked).toBe(true);
  });

  it("locks difficulty 3 and says what opens it", () => {
    const lock = taskLock(hard, tasks, []);
    expect(lock.unlocked).toBe(false);
    if (!lock.unlocked) expect(lock.reason).toBe(`Odemkne se, až v úkolu „${middle.taskTitle}“ dosáhneš úrovně 3 (Pracuje s AI).`);
  });

  it("stays locked after level 2 in the middle task or level 4 in the easy one", () => {
    expect(taskLock(hard, tasks, [attempt(middle.id, 2), attempt(easy.id, 4)]).unlocked).toBe(false);
  });

  it("opens after level 3 in the middle task, and stays open after a weaker attempt", () => {
    expect(taskLock(hard, tasks, [attempt(middle.id, 3)]).unlocked).toBe(true);
    expect(taskLock(hard, tasks, [attempt(middle.id, 3), attempt(middle.id, 1)]).unlocked).toBe(true);
  });

  it("does not count another role's tasks", () => {
    expect(taskLock(hard, tasks, [attempt("project-manager", 4)]).unlocked).toBe(false);
  });
});
