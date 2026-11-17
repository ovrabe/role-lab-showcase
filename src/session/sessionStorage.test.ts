import { describe, expect, it } from "vitest";
import { isAheadOf, loadSession } from "./sessionStorage";
import type { TaskSession } from "./sessionSchema";

const base: TaskSession = {
  version: 1,
  roleId: "qa-release",
  startedAt: "2026-11-17T10:00:00.000Z",
  transcript: [],
  submission: "Návrh",
  reflection: "",
  lastSavedSubmission: "Návrh",
};
const submitted = { ...base, submittedAt: "2026-11-17T10:14:00.000Z" };
const evaluated = { ...submitted, evaluation: {} as TaskSession["evaluation"] };

describe("the same task open in two tabs", () => {
  it("a submission or evaluation from the other tab wins over an older state", () => {
    expect(isAheadOf(submitted, base)).toBe(true);
    expect(isAheadOf(evaluated, submitted)).toBe(true);
  });

  it("an unsubmitted stored state never blocks the tab that is ahead or level", () => {
    expect(isAheadOf(base, submitted)).toBe(false);
    expect(isAheadOf(base, { ...base, submission: "Jiný text" })).toBe(false);
    expect(isAheadOf(submitted, submitted)).toBe(false);
  });

  it("a different attempt (after Začít znovu) is never taken over", () => {
    expect(isAheadOf(submitted, { ...base, startedAt: "2026-11-17T11:00:00.000Z" })).toBe(false);
  });
});

describe("stored data this version cannot read", () => {
  it("is copied aside once before a fresh state can replace it", () => {
    const store = new Map<string, string>();
    const fakeStorage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
    };
    Object.defineProperty(globalThis, "window", { value: { localStorage: fakeStorage }, configurable: true });
    store.set("role-lab:session:qa-release", '{"version":2,"future":"format"}');

    expect(loadSession("qa-release")).toBeNull();
    expect(store.get("role-lab:session:qa-release:neprectene")).toBe('{"version":2,"future":"format"}');

    store.set("role-lab:session:qa-release", "not json");
    loadSession("qa-release");
    expect(store.get("role-lab:session:qa-release:neprectene")).toBe('{"version":2,"future":"format"}');
  });
});
