import { describe, expect, it } from "vitest";
import { RoleDefinition, TaskDefinition } from "./roleSchema";
import { getMaterialText } from "../materials/materialFiles";
import { getEvaluatorKey } from "../evaluation/evaluatorKeys";

// The app checks only the roles that are switched on. Roles in preparation must be just as
// complete before anyone switches them on, so this checks every role and task in data/.
const roleFiles = import.meta.glob("../../data/roles/*.json", { eager: true, import: "default" });
const taskFiles = import.meta.glob("../../data/tasks/*.json", { eager: true, import: "default" });

const roles = Object.entries(roleFiles).map(([path, content]) => ({ path, result: RoleDefinition.safeParse(content) }));
const tasks = Object.entries(taskFiles).map(([path, content]) => ({ path, result: TaskDefinition.safeParse(content) }));
const roleIds = roles.flatMap(({ result }) => (result.success ? [result.data.id] : []));

describe("every role in data/roles", () => {
  it.each(roles.map(({ path, result }) => [path, result] as const))("%s is valid", (_path, result) => {
    expect(result.success ? [] : result.error.issues).toEqual([]);
  });

  it.each(roleIds.map((id) => [id] as const))("%s has at least one task", (roleId) => {
    expect(tasks.some(({ result }) => result.success && result.data.roleId === roleId)).toBe(true);
  });
});

describe("every task in data/tasks", () => {
  it.each(tasks.map(({ path, result }) => [path, result] as const))("%s is valid and complete", (_path, result) => {
    expect(result.success ? [] : result.error.issues).toEqual([]);
    if (!result.success) return;
    const task = result.data;
    expect(roleIds).toContain(task.roleId);
    for (const material of task.materials) expect(getMaterialText(material.file), material.file).toBeDefined();
    expect(getEvaluatorKey(task.id)?.traps.length ?? 0).toBeGreaterThan(0);
  });
});

// Calibration runs (fixtures/<task>.calibration.json) let the author check the evaluator on a
// weak, a medium and a strong attempt before a task is switched on. Private data, like the keys.
const calibrationFiles = import.meta.glob("../../fixtures/*.calibration.json", { eager: true, import: "default" }) as Record<
  string,
  { roleId: string; runs: { id: string; expected: { rank: number; traps: Record<string, string> }; transcript: { turn: number; kind: string; materialId?: string }[] }[] }
>;

describe("every task has calibration runs", () => {
  it.each(tasks.flatMap(({ result }) => (result.success ? [[result.data.id, result.data] as const] : [])))("%s", (taskId, task) => {
    const file = Object.values(calibrationFiles).find((candidate) => candidate.roleId === taskId);
    expect(file, `fixtures/${taskId}.calibration.json`).toBeDefined();
    if (!file) return;
    // At least a weak and a strong run, each with its own rank, each naming every trap of the key.
    const ranks = file.runs.map((run) => run.expected.rank);
    expect(ranks.length).toBeGreaterThanOrEqual(2);
    expect(new Set(ranks).size).toBe(ranks.length);
    const trapIds = getEvaluatorKey(taskId)!.traps.map((trap) => trap.id).sort();
    const materialIds = task.materials.map((material) => material.id);
    for (const run of file.runs) {
      expect(Object.keys(run.expected.traps).sort(), run.id).toEqual(trapIds);
      // Turn numbers as the app writes them: 1, 2, 3… with nothing skipped.
      expect(run.transcript.map((item) => item.turn), run.id).toEqual(run.transcript.map((_, index) => index + 1));
      for (const item of run.transcript) if (item.materialId) expect(materialIds, run.id).toContain(item.materialId);
    }
  });
});
