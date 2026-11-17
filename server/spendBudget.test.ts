import { describe, expect, it } from "vitest";
import { budgetResponse, costMicroUsd, dailyBudgetUsd, recordSpend } from "./spendBudget";
import { memoryCounter, type RateLimiter } from "./rateLimit";
import { handleChat } from "./handlers";
import { loadServerContent } from "./content";
import type { ClaudeClient } from "./claudeClient";

const now = () => new Date("2026-11-17T10:00:00Z");
const limiter = (): RateLimiter => ({ counter: memoryCounter(), secret: "s", now });
const from = (ip: string) => new Request("http://localhost/api/chat", { headers: { "x-real-ip": ip } });

describe("what a call costs", () => {
  it("prices input, output and the cache per model", () => {
    // 10 000 Sonnet input tokens at $2/M = 2 cents; 1 000 output at $10/M = 1 cent.
    expect(costMicroUsd("claude-sonnet-5-5", { input_tokens: 10_000, output_tokens: 1_000 })).toBe(30_000);
    // Cache reads are cheap, cache writes 1.25x the input price.
    expect(costMicroUsd("claude-sonnet-5-5", { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 10_000 })).toBe(1_000);
    expect(costMicroUsd("claude-sonnet-5-5", { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 10_000 })).toBe(25_000);
    expect(costMicroUsd("claude-opus-5-5", { input_tokens: 10_000, output_tokens: 10_000 })).toBe(240_000);
  });

  it("prices an unknown model like the dearest one, never as free", () => {
    expect(costMicroUsd("claude-new-model", { input_tokens: 1_000, output_tokens: 0 })).toBe(4_000);
  });
});

describe("the daily budget", () => {
  const dollars = (amount: number) => ({ input_tokens: 0, output_tokens: Math.round((amount * 1_000_000) / 20) });

  it("lets calls through until one IP address has spent its share", async () => {
    const shared = limiter();
    expect(await budgetResponse(shared, from("1.1.1.1"))).toBeNull();
    await recordSpend(shared, from("1.1.1.1"), "claude-opus-5-5", dollars(dailyBudgetUsd.perIp));
    const refused = await budgetResponse(shared, from("1.1.1.1"));
    expect(refused?.status).toBe(429);
    expect(await refused?.json()).toMatchObject({ error: { code: "limit_person" } });
    expect(await budgetResponse(shared, from("2.2.2.2"))).toBeNull();
  });

  it("stops everyone once the day's total is spent", async () => {
    const shared = limiter();
    const ips = Math.ceil(dailyBudgetUsd.total / dailyBudgetUsd.perIp);
    for (let index = 0; index < ips; index++) {
      await recordSpend(shared, from(`3.3.3.${index}`), "claude-opus-5-5", dollars(dailyBudgetUsd.perIp));
    }
    const refused = await budgetResponse(shared, from("4.4.4.4"));
    expect(await refused?.json()).toMatchObject({ error: { code: "limit_daily" } });
  });

  it("refuses a chat over budget without calling Claude or using the call count", async () => {
    const content = loadServerContent();
    const role = content.roles.activeRoles.find((task) => task.id === "qa-release")!;
    let calls = 0;
    const claude = { async chat() { calls += 1; return { truncated: false }; } } as unknown as ClaudeClient;
    const shared = limiter();
    await recordSpend(shared, from("5.5.5.5"), "claude-opus-5-5", dollars(dailyBudgetUsd.perIp));
    const request = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost", "x-real-ip": "5.5.5.5" },
      body: JSON.stringify({ roleId: role.id, transcript: [{ turn: 1, kind: "user", content: "Ahoj", ts: "2026-11-17T10:00:00.000Z" }] }),
    });
    const response = await handleChat(request, { content, claude, limiter: shared });
    expect(response.status).toBe(429);
    expect(calls).toBe(0);
  });

  it("adds what a finished chat really cost", async () => {
    const content = loadServerContent();
    const role = content.roles.activeRoles.find((task) => task.id === "qa-release")!;
    const claude = {
      async chat(_turns: unknown, options: { onDelta: (text: string) => void; onUsage?: (model: string, usage: object) => Promise<void> }) {
        options.onDelta("ok");
        await options.onUsage?.("claude-opus-5-5", { input_tokens: 0, output_tokens: 75_000 });
        return { truncated: false };
      },
    } as unknown as ClaudeClient;
    const shared = limiter();
    const request = () => new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost", "x-real-ip": "6.6.6.6" },
      body: JSON.stringify({ roleId: role.id, transcript: [{ turn: 1, kind: "user", content: "Ahoj", ts: "2026-11-17T10:00:00.000Z" }] }),
    });
    await (await handleChat(request(), { content, claude, limiter: shared })).text();
    // 75 000 Opus output tokens = $1.50, the whole share of one IP address.
    expect((await handleChat(request(), { content, claude, limiter: shared })).status).toBe(429);
  });

  it("tells the author once a day per ceiling, with what was spent", async () => {
    const { memoryIssueTracker } = await import("./issues");
    const issues = memoryIssueTracker();
    const shared = limiter();
    await recordSpend(shared, from("7.7.7.7"), "claude-opus-5-5", dollars(dailyBudgetUsd.perIp));
    for (let i = 0; i < 3; i++) await budgetResponse(shared, from("7.7.7.7"), issues);
    expect(issues.issues).toHaveLength(1);
    expect(issues.issues[0].title).toContain("jedna adresa");
    expect(issues.issues[0].body).toContain("Celkem dnes utraceno: 1.50 $");
    expect(issues.issues[0].labels).toEqual(["provoz"]);
  });
});
