import { describe, expect, it } from "vitest";
import { computeLevel } from "./computeLevel";
import { loadRoles } from "../roles/loadRoles";
import type { DimensionId } from "../roles/roleSchema";

const { activeRoles } = loadRoles();

// Scores in rubric order: framing, decomposition, verification, iteration, judgment.
const scores = (
  framing: number,
  decomposition: number,
  verification: number,
  iteration: number,
  judgment: number,
): Record<DimensionId, number> => ({ framing, decomposition, verification, iteration, judgment });

describe.each(activeRoles.map((role) => [role.id, role] as const))("computeLevel (%s)", (_id, role) => {
  it("counts the average of the five scores", () => {
    expect(computeLevel(role, scores(4, 3, 2, 3, 3)).average).toBeCloseTo(3);
  });

  it("puts an average exactly on a threshold into the higher level", () => {
    // Five whole scores never average exactly 1.75, 2.5 or 3.25, so move one threshold onto
    // a reachable average. 13 / 5 in floating point must still count as reaching 2.6.
    const shifted = {
      ...role,
      levels: role.levels.map((level) => (level.level === 3 ? { ...level, minAverage: 2.6 } : level)),
    };
    expect(computeLevel(shifted, scores(3, 3, 2, 2, 3)).level).toBe(3); // 2.6
    expect(computeLevel(shifted, scores(3, 3, 2, 2, 2)).level).toBe(2); // 2.4
  });

  it("uses the thresholds from the config, including fractional averages", () => {
    // 1.6 stays on level 1, 1.8 reaches level 2 (threshold 1.75).
    expect(computeLevel(role, scores(2, 2, 2, 1, 1)).level).toBe(1);
    expect(computeLevel(role, scores(2, 2, 2, 2, 1)).level).toBe(2);
    // 2.4 stays on level 2, 2.6 reaches level 3 (threshold 2.5).
    expect(computeLevel(role, scores(3, 3, 2, 2, 2)).level).toBe(2);
    // 3.2 stays on level 3, 3.4 reaches level 4 (threshold 3.25).
    expect(computeLevel(role, scores(4, 3, 3, 3, 3)).level).toBe(3);
  });

  it("gives the lowest and highest level at the ends of the scale", () => {
    expect(computeLevel(role, scores(1, 1, 1, 1, 1)).level).toBe(1);
    expect(computeLevel(role, scores(4, 4, 4, 4, 4)).level).toBe(4);
  });

  it("caps the level when verification is at 1", () => {
    const result = computeLevel(role, scores(4, 4, 1, 4, 4)); // average 3.4 would be level 4
    expect(result.levelBeforeCap).toBe(4);
    expect(result.level).toBe(role.capRule.maxLevel);
    expect(result.capApplied).toBe(true);
    expect(result.capReason).toContain("Ověřování");
  });

  it("caps the level when judgment is at 1", () => {
    const result = computeLevel(role, scores(4, 4, 4, 4, 1));
    expect(result.level).toBe(role.capRule.maxLevel);
    expect(result.capReason).toContain("Úsudek");
  });

  it("does not report a cap when the level is already at or below the cap", () => {
    const result = computeLevel(role, scores(2, 2, 1, 2, 2)); // average 1.8, level 2
    expect(result.level).toBe(2);
    expect(result.capApplied).toBe(false);
    expect(result.capReason).toBeNull();
  });

  it("ignores low scores in dimensions outside the cap rule", () => {
    const result = computeLevel(role, scores(1, 4, 4, 4, 4)); // framing at 1, average 3.4
    expect(result.level).toBe(4);
    expect(result.capApplied).toBe(false);
  });

  it("recomputes after a reviewer changes a score", () => {
    const aiScores = scores(3, 3, 3, 3, 3);
    expect(computeLevel(role, aiScores).level).toBe(3);
    expect(computeLevel(role, { ...aiScores, verification: 1 }).level).toBe(2);
    expect(computeLevel(role, { ...aiScores, framing: 4, iteration: 4 }).level).toBe(4);
  });
});
