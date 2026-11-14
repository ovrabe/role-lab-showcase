import { describe, expect, it } from "vitest";
import { loadRoles } from "./loadRoles";
import { getEvaluatorKey } from "../evaluation/evaluatorKeys";

describe("role configs", () => {
  const { activeRoles, errors } = loadRoles();

  it("are all valid and every material file exists", () => {
    expect(errors).toEqual([]);
  });

  it("include both roles", () => {
    expect(activeRoles.map((role) => role.id).sort()).toEqual(["category-manager", "project-manager"]);
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
