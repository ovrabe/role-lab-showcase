import { describe, expect, it } from "vitest";
import { loadChallenges } from "./loadChallenges";
import { parseChallenges } from "./parseChallenges";

const { challenges, errors } = loadChallenges();
const validChallenge = structuredClone(challenges[0]);

describe("challenge configs in data/challenges", () => {
  it("all load without errors", () => {
    expect(errors).toEqual([]);
    expect(challenges.length).toBeGreaterThanOrEqual(3);
  });

  it("have unique ids", () => {
    const ids = challenges.map((challenge) => challenge.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("never name a trap in what the person sees", () => {
    // The task asks what to check; words like these would give the answer away.
    for (const challenge of challenges) {
      expect(`${challenge.title} ${challenge.task}`).not.toMatch(/chyb[aěuy] je|záludnost|past/i);
    }
  });
});

describe("parseChallenges", () => {
  it("rejects a file whose name does not match the id", () => {
    const { challenges: loaded, errors: problems } = parseChallenges({ "../../data/challenges/other.json": validChallenge });
    expect(loaded).toEqual([]);
    expect(problems[0].problems[0]).toContain(`${validChallenge.id}.json`);
  });

  it("rejects an unknown skill and an empty task with readable messages", () => {
    const broken = { ...validChallenge, skill: "speed", task: " " };
    const { errors: problems } = parseChallenges({ [`x/${validChallenge.id}.json`]: broken });
    expect(problems[0].problems.some((problem) => problem.startsWith("skill:"))).toBe(true);
    expect(problems[0].problems.some((problem) => problem.startsWith("task:"))).toBe(true);
  });

  it("rejects an empty file", () => {
    const { errors: problems } = parseChallenges({ "x/empty.json": {} });
    expect(problems).toHaveLength(1);
  });

  it("reports two challenges with the same place on the map", () => {
    const twin = { ...validChallenge, id: "twin" };
    const { errors: problems } = parseChallenges({ [`x/${validChallenge.id}.json`]: validChallenge, "x/twin.json": twin });
    expect(problems[0].problems[0]).toContain("pořadí");
  });

  it("sorts by skill in rubric order, then by order", () => {
    const framing = { ...validChallenge, id: "framing-one", skill: "framing", order: 2 };
    const verificationFirst = { ...validChallenge, id: "verification-one", skill: "verification", order: 1 };
    const framingFirst = { ...validChallenge, id: "framing-zero", skill: "framing", order: 1 };
    const { challenges: sorted } = parseChallenges({
      "x/verification-one.json": verificationFirst,
      "x/framing-one.json": framing,
      "x/framing-zero.json": framingFirst,
    });
    expect(sorted.map((challenge) => challenge.id)).toEqual(["framing-zero", "framing-one", "verification-one"]);
  });
});
