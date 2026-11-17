import { describe, expect, it } from "vitest";
import tips from "../../data/tips.json";
import { weakestDimension } from "./PromptTips";
import { loadRoles } from "../roles/loadRoles";
import type { StoredEvaluation } from "../evaluation/evaluationSchema";

const role = loadRoles().activeRoles[0];
const withScores = (scores: Record<string, number>) =>
  ({ output: { dimensions: Object.entries(scores).map(([id, score]) => ({ id, score, rationale: "", evidence: [] })) } }) as unknown as StoredEvaluation;

describe("prompt tips", () => {
  it("has tips for every rubric area, without slash forms", () => {
    for (const { id } of role.rubric) {
      const list = (tips as unknown as Record<string, string[]>)[id];
      expect(list.length).toBeGreaterThanOrEqual(3);
      // Placeholders like [firma/obor] are fine; forms like "měl/a" are not.
      for (const tip of list) expect(tip.replace(/\[[^\]]*\]/g, "")).not.toMatch(/\p{L}\/\p{L}/u);
    }
  });

  it("picks the lowest score, the first area on a tie, and nothing when all are 4", () => {
    expect(weakestDimension(role, withScores({ framing: 3, decomposition: 2, verification: 2, iteration: 4, judgment: 3 }))).toBe("decomposition");
    expect(weakestDimension(role, withScores({ framing: 4, decomposition: 4, verification: 4, iteration: 4, judgment: 4 }))).toBeNull();
  });
});
