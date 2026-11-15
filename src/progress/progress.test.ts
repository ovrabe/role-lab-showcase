import { afterEach, describe, expect, it, vi } from "vitest";
import { loadRoles } from "../roles/loadRoles";
import { loadPreviewSamples } from "../evaluation/previewFixture";
import { attemptFromEvaluation, attemptIndex, changesAt, recommendedSkill, skillLevels, withAttempt, emptyProgress, type ProgressAttempt } from "./progress";
import { allBadges, badgesAt, earnedBadges } from "./badges";
import { loadProgress, recordAttempt } from "./progressStorage";

const { activeRoles } = loadRoles();
const role = activeRoles.find((candidate) => candidate.id === "category-manager")!;
const samples = loadPreviewSamples(role);
const weak = samples.find((sample) => sample.id === "weak")!.session.evaluation!;
const strong = samples.find((sample) => sample.id === "strong")!.session.evaluation!;

const attempt = (roleId: string, day: number, scores: number[], traps = { caught: 0, total: 2 }): ProgressAttempt => ({
  roleId,
  evaluatedAt: `2026-11-${String(day).padStart(2, "0")}T10:00:00.000Z`,
  level: 2,
  scores: { framing: scores[0], decomposition: scores[1], verification: scores[2], iteration: scores[3], judgment: scores[4] },
  traps,
});

describe("attemptFromEvaluation", () => {
  it("keeps only the scores, the level and the trap count", () => {
    const record = attemptFromEvaluation(role, weak);
    expect(record).toMatchObject({ roleId: role.id, level: 1, scores: { framing: 2, decomposition: 1 } });
    expect(record.traps.total).toBe(weak.output.traps.length);
    expect(JSON.stringify(record)).not.toContain(weak.output.summary);
  });

  it("counts traps caught by a strong attempt", () => {
    const record = attemptFromEvaluation(role, strong);
    expect(record.traps.caught).toBe(record.traps.total);
    expect(record.level).toBe(4);
  });
});

describe("progress over attempts", () => {
  it("records the same evaluation only once", () => {
    const first = attempt("category-manager", 1, [2, 1, 1, 1, 1]);
    const progress = withAttempt(withAttempt(emptyProgress, first), first);
    expect(progress.attempts).toHaveLength(1);
  });

  it("uses the latest score of each skill, across roles", () => {
    const attempts = [attempt("category-manager", 1, [2, 1, 1, 1, 1]), attempt("project-manager", 2, [3, 2, 3, 1, 2])];
    expect(skillLevels(attempts)).toEqual({ framing: 3, decomposition: 2, verification: 3, iteration: 1, judgment: 2 });
  });

  it("reports what the latest attempt changed, up and down", () => {
    const attempts = [attempt("category-manager", 1, [2, 1, 2, 1, 1]), attempt("category-manager", 2, [2, 2, 3, 1, 1])];
    expect(changesAt(attempts, 1)).toEqual([
      { dimension: "decomposition", from: 1, to: 2 },
      { dimension: "verification", from: 2, to: 3 },
    ]);
    expect(changesAt(attempts, 0)).toEqual([]);
  });

  it("finds the attempt of an older evaluation and what it changed back then", () => {
    const attempts = [
      attempt("category-manager", 1, [2, 1, 2, 1, 1]),
      attempt("category-manager", 2, [3, 1, 2, 1, 1]),
      attempt("project-manager", 3, [3, 3, 3, 3, 3]),
    ];
    const index = attemptIndex(attempts, "category-manager", "2026-11-02T10:00:00.000Z");
    expect(index).toBe(1);
    expect(changesAt(attempts, index)).toEqual([{ dimension: "framing", from: 2, to: 3 }]);
    expect(attemptIndex(attempts, "category-manager", "2026-01-01T00:00:00.000Z")).toBe(-1);
  });

  it("recommends the weakest skill, the earlier one on a tie", () => {
    expect(recommendedSkill({ framing: 3, decomposition: 2, verification: 3, iteration: 2, judgment: 2 })).toBe("decomposition");
    expect(recommendedSkill({})).toBeNull();
  });
});

describe("badges", () => {
  const ids = (badges: { id: string }[]) => badges.map((badge) => badge.id);

  it("gives a perfect first try a lot, but not everything", () => {
    const earned = ids(earnedBadges([{ ...attempt("category-manager", 1, [4, 4, 4, 4, 4], { caught: 2, total: 2 }), level: 4 }]));
    expect(earned).toEqual(expect.arrayContaining(["first-attempt", "data-detective", "master-verification", "level-four", "all-round"]));
    // Nothing that needs time, a second role or growth.
    expect(earned).not.toContain("five-attempts");
    expect(earned).not.toContain("three-days");
    expect(earned).not.toContain("both-roles");
    expect(earned).not.toContain("step-up");
  });

  it("gives an ordinary first try only a few of the twenty", () => {
    const earned = earnedBadges([attempt("category-manager", 1, [2, 1, 2, 1, 1])]);
    expect(ids(earned)).toEqual(["first-attempt"]);
    expect(allBadges).toHaveLength(20);
  });

  it("names only the badges the latest attempt added", () => {
    const attempts = [attempt("category-manager", 1, [2, 1, 2, 1, 1]), attempt("project-manager", 2, [2, 2, 3, 2, 2])];
    expect(ids(badgesAt(attempts, 1))).toEqual(["step-up", "on-recommendation", "both-roles", "no-weak-spot"]);
  });

  it("does not count a step down as a step up", () => {
    const attempts = [attempt("category-manager", 1, [3, 3, 3, 3, 3]), attempt("category-manager", 2, [2, 2, 2, 2, 2])];
    expect(ids(earnedBadges(attempts))).not.toContain("step-up");
  });

  it("keeps a badge once earned, even after a weaker attempt", () => {
    const attempts = [attempt("category-manager", 1, [3, 3, 3, 3, 3]), attempt("category-manager", 2, [1, 1, 1, 1, 1])];
    expect(ids(earnedBadges(attempts))).toContain("all-round");
  });

  it("rewards a big leap and following the recommendation", () => {
    const attempts = [attempt("category-manager", 1, [3, 3, 3, 1, 3]), attempt("category-manager", 2, [3, 3, 3, 3, 3])];
    expect(ids(badgesAt(attempts, 1))).toEqual(expect.arrayContaining(["big-leap", "on-recommendation"]));
  });

  it("counts different days, not attempts on one day", () => {
    const sameDay = [1, 2, 3].map(() => attempt("category-manager", 1, [2, 2, 2, 2, 2]));
    sameDay.forEach((item, index) => (item.evaluatedAt = `2026-11-01T1${index}:00:00.000Z`));
    expect(ids(earnedBadges(sameDay))).not.toContain("three-days");
    const threeDays = [1, 2, 3].map((day) => attempt("category-manager", day, [2, 2, 2, 2, 2]));
    expect(ids(earnedBadges(threeDays))).toContain("three-days");
  });

  it("counts roles, not tasks: two tasks of one role are not both roles", () => {
    const sameRole = [
      attempt("category-manager", 1, [2, 2, 2, 2, 2], { caught: 2, total: 2 }),
      attempt("category-manager-newsletter", 2, [2, 2, 2, 2, 2], { caught: 1, total: 1 }),
    ];
    expect(ids(earnedBadges(sameRole))).not.toContain("both-roles");
    expect(ids(earnedBadges(sameRole))).not.toContain("detective-both-roles");
  });

  it("needs all traps in both roles for the second detective badge", () => {
    const attempts = [
      attempt("category-manager", 1, [2, 2, 2, 2, 2], { caught: 2, total: 2 }),
      attempt("project-manager", 2, [2, 2, 2, 2, 2], { caught: 1, total: 3 }),
    ];
    expect(ids(earnedBadges(attempts))).not.toContain("detective-both-roles");
    attempts.push(attempt("project-manager", 3, [2, 2, 2, 2, 2], { caught: 3, total: 3 }));
    expect(ids(earnedBadges(attempts))).toContain("detective-both-roles");
  });
});

describe("progress storage", () => {
  afterEach(() => vi.unstubAllGlobals());

  function stubStorage(initial: Record<string, string> = {}) {
    const items = new Map(Object.entries(initial));
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => items.get(key) ?? null,
        setItem: (key: string, value: string) => void items.set(key, value),
        removeItem: (key: string) => void items.delete(key),
      },
    });
    return items;
  }

  it("saves attempts and reads them back", () => {
    stubStorage();
    expect(recordAttempt(attempt("category-manager", 1, [2, 1, 1, 1, 1]))).toBe(true);
    recordAttempt(attempt("category-manager", 2, [2, 2, 1, 1, 1]));
    expect(loadProgress().attempts.map((item) => item.evaluatedAt)).toEqual(["2026-11-01T10:00:00.000Z", "2026-11-02T10:00:00.000Z"]);
  });

  it("starts empty when the stored value is broken", () => {
    stubStorage({ "role-lab:progress": "{nope" });
    expect(loadProgress()).toEqual(emptyProgress);
  });

  it("keeps working without storage", () => {
    vi.stubGlobal("window", {});
    expect(loadProgress()).toEqual(emptyProgress);
    expect(recordAttempt(attempt("category-manager", 1, [2, 1, 1, 1, 1]))).toBe(false);
  });
});
