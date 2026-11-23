import { describe, expect, it } from "vitest";
import { attentionItems } from "./attention";
import type { AdminOverview } from "./adminApi";

const base: AdminOverview = {
  generatedAt: "2026-11-23T10:00:00.000Z",
  days: [],
  previousDays: [],
  budget: { perIpUsd: 1.5, totalUsd: 3, spentTodayUsd: 0 },
  limits: { perPerson: {}, total: {} },
  tasks: [],
  pendingShares: [],
  generationOff: false,
  feedback: [],
  log: [],
};
const withMetrics = (metrics: Record<string, number>, change: Partial<AdminOverview> = {}): AdminOverview => ({ ...base, days: [{ day: "2026-11-23", metrics, visitors: 1 }], ...change });
const texts = (data: AdminOverview) => attentionItems(data, (id) => id, new Date("2026-11-23T12:00:00Z")).map((item) => `${item.level}: ${item.text}`);

describe("Co řešit", () => {
  it("stays quiet when there is nothing to do", () => {
    expect(texts(base)).toEqual([]);
  });

  it("warns about spending, failing calls and page errors, warnings first", () => {
    const items = texts(withMetrics({ "call.chat.ok": 9, "call.chat.error": 1, "client_error.script": 2 }, { budget: { perIpUsd: 1.5, totalUsd: 3, spentTodayUsd: 2.4 }, pendingShares: [{ id: "x", title: "t", roleTitle: "r", requestedAt: "", brief: { situation: "", task: "" }, trap: "" }] }));
    expect(items[0]).toContain("80 % denního stropu");
    expect(items).toEqual(expect.arrayContaining([expect.stringContaining("Asistent: 10 %"), expect.stringContaining("chyba"), expect.stringContaining("Čeká 1 žádost")]));
    expect(items.at(-1)).toMatch(/^info/);
  });

  it("needs enough data before flagging a task", () => {
    expect(texts(withMetrics({ "outcome.qa.count": 2, "outcome.qa.trap.T1_x.missed": 2 }))).toEqual([]);
    expect(texts(withMetrics({ "outcome.qa.count": 4, "outcome.qa.trap.T1_x.missed": 4 }))).toEqual([expect.stringContaining("záludnost T1_x mine 100 %")]);
    expect(texts(withMetrics({ "funnel.qa.started": 6, "funnel.qa.first_message": 2 }))).toEqual([expect.stringContaining("jen 33 % lidí napíše")]);
  });

  it("counts only recent feedback", () => {
    const feedback = [
      { kind: "note" as const, message: "a", at: "2026-11-22T10:00:00.000Z" },
      { kind: "note" as const, message: "b", at: "2026-11-01T10:00:00.000Z" },
    ];
    expect(texts({ ...base, feedback })).toEqual(["info: Nová zpětná vazba za posledních 7 dní: 1."]);
  });
});
