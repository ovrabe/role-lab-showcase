import { describe, expect, it } from "vitest";
import { loadChallenges } from "./loadChallenges";
import { findChallengeKey } from "./parseChallenges";
import { ChallengeKey } from "./challengeSchema";

// Needs the evaluator's keys, so the public copy of the code skips it (vite.config.ts).
const keyFiles = import.meta.glob("../../evaluator-data/challenges/*.key.json", { eager: true, import: "default" });
const { challenges } = loadChallenges();

describe("challenge keys in evaluator-data/challenges", () => {
  it("every key file is valid and named after its challenge", () => {
    for (const [path, content] of Object.entries(keyFiles)) {
      const key = ChallengeKey.parse(content);
      expect(path.endsWith(`/${key.challengeId}.key.json`)).toBe(true);
    }
  });

  it("every challenge has a key, and every key has a challenge", () => {
    for (const challenge of challenges) expect(findChallengeKey(keyFiles, challenge.id), challenge.id).not.toBeNull();
    const challengeIds = challenges.map((challenge) => challenge.id);
    for (const content of Object.values(keyFiles)) expect(challengeIds).toContain(ChallengeKey.parse(content).challengeId);
  });

  it("no trap title or explanation appears in what the person sees", () => {
    for (const challenge of challenges) {
      const visible = JSON.stringify(challenge);
      for (const trap of findChallengeKey(keyFiles, challenge.id)!.traps) {
        expect(visible).not.toContain(trap.title);
        expect(visible).not.toContain(trap.whatIsWrong);
      }
    }
  });
});
