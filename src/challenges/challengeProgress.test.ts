import { describe, expect, it } from "vitest";
import { bestScores, emptyChallengeProgress, withRecord, type ChallengeRecord } from "./challengeProgress";
import { dailyChallenge, pragueDay } from "./dailyChallenge";
import { loadChallenges } from "./loadChallenges";

const { challenges } = loadChallenges();

const record = (challengeId: string, score: number): ChallengeRecord => ({
  challengeId,
  skill: "verification",
  score,
  caught: 1,
  total: 3,
  completedAt: "2026-11-15T10:00:00.000Z",
});

describe("challenge progress", () => {
  it("keeps the best score per challenge", () => {
    let progress = emptyChallengeProgress;
    for (const item of [record("a", 2), record("a", 4), record("a", 3), record("b", 1)]) progress = withRecord(progress, item);
    expect(bestScores(progress.records)).toEqual({ a: 4, b: 1 });
  });

  it("has no score for a challenge never tried", () => {
    expect(bestScores([])).toEqual({});
  });
});

describe("dailyChallenge", () => {
  it("is the same for the same day", () => {
    expect(dailyChallenge(challenges, "2026-11-15")).toBe(dailyChallenge(challenges, "2026-11-15"));
  });

  it("goes through every challenge once in a round of days", () => {
    const days = Array.from({ length: challenges.length }, (_, index) => pragueDay(new Date(Date.UTC(2026, 10, 15 + index, 12))));
    const picked = days.map((day) => dailyChallenge(challenges, day)!.id);
    expect(new Set(picked).size).toBe(challenges.length);
  });

  it("changes the skill from one day to the next", () => {
    const today = dailyChallenge(challenges, "2026-11-15")!;
    const tomorrow = dailyChallenge(challenges, "2026-11-16")!;
    expect(tomorrow.skill).not.toBe(today.skill);
  });

  it("returns nothing when there are no challenges", () => {
    expect(dailyChallenge([], "2026-11-15")).toBeNull();
  });

  it("uses the Prague calendar day", () => {
    // 23:30 UTC on 14 November is already 15 November in Prague.
    expect(pragueDay(new Date("2026-11-14T23:30:00Z"))).toBe("2026-11-15");
  });
});
