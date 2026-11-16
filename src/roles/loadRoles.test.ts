import { describe, expect, it } from "vitest";
import { loadRoles } from "./loadRoles";
import { parseRoles } from "./parseRoles";
import { roleOfTask } from "./taskRoles";
import type { TaskDefinition } from "./roleSchema";
import { getEvaluatorKey } from "../evaluation/evaluatorKeys";

describe("role configs", () => {
  const { activeRoles, errors } = loadRoles();

  it("are all valid and every material file exists", () => {
    expect(errors).toEqual([]);
  });

  it("include all eight roles; the two original ones keep their first task under the role's id", () => {
    expect([...new Set(activeRoles.map((task) => task.roleId))].sort()).toEqual([
      "ai-tech-lead",
      "category-manager",
      "it-helpdesk",
      "marketer",
      "project-manager",
      "qa",
      "recruiter",
      "research-associate",
    ]);
    // The original tasks keep the role's id, so attempts saved before roles had several tasks still match.
    expect(activeRoles.filter((task) => task.id === task.roleId).map((task) => task.difficulty)).toEqual([2, 2]);
  });

  it.each(activeRoles.map((role) => [role.id, role] as const))("%s has a consistent rubric and levels", (_id, role) => {
    // The cap rule must name dimensions that exist and a level that exists.
    const dimensionIds = role.rubric.map((dimension) => dimension.id);
    for (const id of role.capRule.dimensions) expect(dimensionIds).toContain(id);
    expect(role.levels.map((level) => level.level)).toContain(role.capRule.maxLevel);
    // The lowest level starts at 0, so every average has a level.
    expect(Math.min(...role.levels.map((level) => level.minAverage))).toBe(0);
  });

  it.each(activeRoles.map((role) => [role.id] as const))("%s has an evaluator key with traps", (id) => {
    expect(getEvaluatorKey(id)?.traps.length).toBeGreaterThan(0);
  });
});

describe("parseRoles with roles and tasks apart", () => {
  const roleFiles = import.meta.glob("../../data/roles/*.json", { eager: true, import: "default" });
  const taskFiles = import.meta.glob("../../data/tasks/*.json", { eager: true, import: "default" }) as Record<string, TaskDefinition>;
  const cmTask = Object.values(taskFiles).find((task) => task.id === "category-manager")!;
  // Every material file "exists": these tests are about roles and tasks, not files.
  const allFiles = () => "obsah";

  it("keeps the role's name and the task's own name apart", () => {
    const task = loadRoles().activeRoles.find((candidate) => candidate.id === "category-manager")!;
    expect(task.title).toBe("Category manager");
    expect(task.taskTitle.length).toBeGreaterThan(0);
    expect(task.roleId).toBe("category-manager");
  });

  it("reports a task whose role does not exist", () => {
    const { errors } = parseRoles(roleFiles, { "x/lost.json": { ...cmTask, id: "lost", roleId: "astronaut" } }, allFiles);
    expect(errors.some((error) => error.problems[0].includes("astronaut"))).toBe(true);
  });

  it("reports a missing material file", () => {
    const { errors } = parseRoles(roleFiles, { "x/cm.json": cmTask }, () => undefined);
    expect(errors.some((error) => error.problems.some((problem) => problem.includes("neexistuje")))).toBe(true);
  });

  it("reports an active role with no task", () => {
    const { errors } = parseRoles(roleFiles, {}, allFiles);
    expect(errors.map((error) => error.file)).toContain("data/roles/category-manager.json");
  });

  it("sorts tasks by role, then from the easiest", () => {
    const harder = { ...cmTask, id: "cm-hard", difficulty: 3 };
    const easier = { ...cmTask, id: "cm-easy", difficulty: 1 };
    const { activeRoles } = parseRoles(roleFiles, { "a.json": harder, "b.json": cmTask, "c.json": easier }, allFiles);
    expect(activeRoles.map((task) => task.id)).toEqual(["cm-easy", "category-manager", "cm-hard"]);
  });
});

describe("roleOfTask", () => {
  it("maps a task to its role and leaves unknown ids as they are", () => {
    expect(roleOfTask("project-manager")).toBe("project-manager");
    expect(roleOfTask("smazany-ukol")).toBe("smazany-ukol");
  });
});
