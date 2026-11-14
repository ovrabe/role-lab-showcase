import { afterEach, describe, expect, it, vi } from "vitest";
import { avatarColors, defaultAvatar, isUnlocked, loadAvatar, saveAvatar, stations, unlockHint } from "./avatar";
import { allBadges } from "../progress/badges";

function stubStorage(initial: Record<string, string> = {}) {
  const items = new Map(Object.entries(initial));
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => items.get(key) ?? null,
      setItem: (key: string, value: string) => void items.set(key, value),
      removeItem: (key: string) => void items.delete(key),
    },
    dispatchEvent: () => true,
  });
  return items;
}

describe("avatar", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("unlocks every badge-bound station with a badge that exists", () => {
    const badgeIds = new Set(allBadges.map((badge) => badge.id));
    for (const item of [...stations, ...avatarColors]) {
      if (item.unlock.kind === "badge") expect(badgeIds.has(item.unlock.badgeId)).toBe(true);
    }
  });

  it("keeps the gate for the one who has all twenty badges", () => {
    const gate = stations.find((station) => station.id === "gate")!;
    expect(isUnlocked(gate.unlock, new Set(allBadges.slice(0, 19).map((badge) => badge.id)))).toBe(false);
    expect(isUnlocked(gate.unlock, new Set(allBadges.map((badge) => badge.id)))).toBe(true);
    expect(unlockHint(gate.unlock)).toContain("všech 20");
  });

  it("saves and loads the choice", () => {
    stubStorage();
    saveAvatar({ station: "cat", color: "aurora", nickname: "Ondra" });
    expect(loadAvatar(new Set())).toEqual({ station: "cat", color: "aurora", nickname: "Ondra" });
  });

  it("falls back to the default for a locked or unknown choice", () => {
    stubStorage({ "role-lab:avatar": JSON.stringify({ station: "eye-of-horus", color: "gold-dust", nickname: "" }) });
    expect(loadAvatar(new Set())).toEqual(defaultAvatar);
    expect(loadAvatar(new Set(["seven-days", ...allBadges.slice(0, 10).map((badge) => badge.id)]))).toMatchObject({
      station: "eye-of-horus",
      color: "gold-dust",
    });
    stubStorage({ "role-lab:avatar": "{nope" });
    expect(loadAvatar(new Set())).toEqual(defaultAvatar);
  });
});
