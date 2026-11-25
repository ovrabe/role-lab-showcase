import { describe, expect, it } from "vitest";
import { costMicroUsd, dailyBudgetUsd, recordSpend, reserveBudget, worstCaseMicroUsd } from "./spendBudget";
import type { IssueTracker } from "./issues";
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

// A tiny hold, given back at once: "may a call go ahead right now?"
async function budgetResponse(shared: RateLimiter, request: Request, issues: IssueTracker | null = null): Promise<Response | null> {
  const reservation = await reserveBudget(shared, request, issues, 1);
  if (reservation instanceof Response) return reservation;
  await reservation.settle();
  return null;
}

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
        await options.onUsage?.("claude-opus-5-5", { input_tokens: 0, output_tokens: (dailyBudgetUsd.perIp * 1_000_000) / 20 });
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
    // Opus output tokens worth the whole share of one IP address ($20 per million).
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
    expect(issues.issues[0].body).toContain(`Celkem dnes utraceno: ${dailyBudgetUsd.perIp.toFixed(2)} $`);
    expect(issues.issues[0].labels).toEqual(["provoz"]);
  });

  it("holds the worst case before the call, so requests at the same moment cannot all slip under the ceiling", async () => {
    const shared = limiter();
    // Each hold is $0.40: calls start while less than the address's share is spent or held
    // (0, 0.40, 0.80, …), so only that many of 20 parallel calls get through, not all 20.
    const fits = Math.ceil(dailyBudgetUsd.perIp / 0.4);
    const holds = await Promise.all(Array.from({ length: 20 }, () => reserveBudget(shared, from("8.8.8.8"), null, 400_000)));
    expect(holds.filter((hold) => !(hold instanceof Response))).toHaveLength(fits);
    const refused = holds.filter((hold): hold is Response => hold instanceof Response);
    expect(refused).toHaveLength(20 - fits);
    // Nothing is spent yet, only held: a busy moment, not "try tomorrow".
    expect(await refused[0].json()).toMatchObject({ error: { code: "budget_busy" } });
  });

  it("replaces the hold with the real cost when the call reports it", async () => {
    const shared = limiter();
    const hold = await reserveBudget(shared, from("9.9.9.9"), null, dailyBudgetUsd.perIp * 1_000_000);
    if (hold instanceof Response) throw new Error("refused");
    // While held, nothing more fits for this address.
    expect(await budgetResponse(shared, from("9.9.9.9"))).not.toBeNull();
    await hold.record("claude-haiku-5-5", { input_tokens: 1000, output_tokens: 1000 });
    await hold.settle();
    expect(await budgetResponse(shared, from("9.9.9.9"))).toBeNull();
    expect(await shared.counter.add!(`spend:2026-11-17:total`, 0)).toBe(costMicroUsd("claude-haiku-5-5", { input_tokens: 1000, output_tokens: 1000 }));
  });

  it("keeps the hold when the person cut the connection and no cost was reported", async () => {
    const shared = limiter();
    const controller = new AbortController();
    const request = new Request("http://localhost/api/evaluate", { headers: { "x-real-ip": "10.0.0.1" }, signal: controller.signal });
    const hold = await reserveBudget(shared, request, null, 500_000);
    if (hold instanceof Response) throw new Error("refused");
    controller.abort();
    await hold.settle();
    expect(await shared.counter.add!(`spend:2026-11-17:total`, 0)).toBe(500_000);
  });

  it("gives the hold back when the call failed on Anthropic's side without a cut connection", async () => {
    const shared = limiter();
    const hold = await reserveBudget(shared, from("10.0.0.2"), null, 500_000);
    if (hold instanceof Response) throw new Error("refused");
    await hold.settle();
    await hold.settle();
    expect(await shared.counter.add!(`spend:2026-11-17:total`, 0)).toBe(0);
  });

  it("still lets an honest person near the ceiling start an expensive call", async () => {
    const shared = limiter();
    await recordSpend(shared, from("12.0.0.1"), "claude-haiku-5-5", { input_tokens: 0, output_tokens: 2_800_000 });
    // $1.40 spent of $1.50: an evaluation holding $0.80 may still start.
    expect(await reserveBudget(shared, from("12.0.0.1"), null, 800_000)).not.toBeInstanceOf(Response);
  });

  it("prices the worst case from the prompt length and the whole output allowance", () => {
    // 20 000 characters ≈ 10 000 tokens of Opus input as a cache write, plus 32 000 output tokens.
    expect(worstCaseMicroUsd("claude-opus-5-5", 20_000, 32_000)).toBe(10_000 * 4 * 1.25 + 32_000 * 20);
  });

  it("counts a chat cut off mid-answer as its prompt plus what was already written, not the whole allowance", async () => {
    const content = loadServerContent();
    const role = content.roles.activeRoles.find((task) => task.id === "qa-release")!;
    const controller = new AbortController();
    const claude = {
      async chat(_turns: unknown, options: { onDelta: (text: string) => void }) {
        options.onDelta("x".repeat(1000));
        controller.abort();
        throw { code: "cancelled", message: "Aborted." };
      },
    } as unknown as ClaudeClient;
    const shared = limiter();
    const request = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost", "x-real-ip": "11.0.0.1" },
      body: JSON.stringify({ roleId: role.id, transcript: [{ turn: 1, kind: "user", content: "Ahoj", ts: "2026-11-17T10:00:00.000Z" }] }),
      signal: controller.signal,
    });
    await (await handleChat(request, { content, claude, limiter: shared })).text();
    const kept = await shared.counter.add!(`spend:2026-11-17:total`, 0);
    expect(kept).toBeGreaterThan(worstCaseMicroUsd("claude-sonnet-5-5", 0, 500));
    expect(kept).toBeLessThan(worstCaseMicroUsd("claude-sonnet-5-5", 0, 16_000));
  });

  it("shows the author what calls really cost, not what running calls hold", async () => {
    const { spentTodayMicroUsd } = await import("./spendBudget");
    const shared = limiter();
    const hold = await reserveBudget(shared, from("13.0.0.1"), null, 2_000_000);
    if (hold instanceof Response) throw new Error("refused");
    expect(await spentTodayMicroUsd(shared)).toBe(0);
    await hold.record("claude-haiku-5-5", { input_tokens: 0, output_tokens: 1000 });
    await hold.settle();
    expect(await spentTodayMicroUsd(shared)).toBe(costMicroUsd("claude-haiku-5-5", { input_tokens: 0, output_tokens: 1000 }));
  });

  it("ends a chat whose page stopped reading as cancelled: no false alarm, the written part counted", async () => {
    const { memoryNotifier } = await import("./notify");
    const notifier = memoryNotifier();
    const content = loadServerContent();
    const role = content.roles.activeRoles.find((task) => task.id === "qa-release")!;
    const claude = {
      async chat(_turns: unknown, options: { signal: AbortSignal; onDelta: (text: string) => void }) {
        for (let chunk = 0; chunk < 50; chunk++) {
          if (options.signal.aborted) throw { code: "cancelled", message: "Aborted." };
          options.onDelta("x".repeat(100));
          await new Promise((resolve) => setTimeout(resolve, 1));
        }
        return { truncated: false };
      },
    } as unknown as ClaudeClient;
    const shared: RateLimiter = { ...limiter(), notifier };
    const request = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost", "x-real-ip": "14.0.0.1" },
      body: JSON.stringify({ roleId: role.id, transcript: [{ turn: 1, kind: "user", content: "Ahoj", ts: "2026-11-17T10:00:00.000Z" }] }),
    });
    const reader = (await handleChat(request, { content, claude, limiter: shared })).body!.getReader();
    await reader.read();
    await reader.cancel();
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(notifier.messages).toHaveLength(0);
    const { spentTodayMicroUsd } = await import("./spendBudget");
    expect(await spentTodayMicroUsd(shared)).toBeGreaterThan(0);
  });

  it("holds a second worst case before a second try, and does not retry when it does not fit", async () => {
    const shared = limiter();
    const hold = await reserveBudget(shared, from("15.0.0.1"), null, 1_000_000);
    if (hold instanceof Response) throw new Error("refused");
    expect(await hold.holdAnother()).toBe(true);
    expect(await shared.counter.add!("spend:2026-11-17:total", 0)).toBe(2_000_000);
    // Holds of 1 $ start while less than the address's share is held: that many in all, then no more.
    for (let held = 2; held < dailyBudgetUsd.perIp; held++) expect(await hold.holdAnother()).toBe(true);
    expect(await hold.holdAnother()).toBe(false);
    await hold.settle();
    expect(await shared.counter.add!("spend:2026-11-17:total", 0)).toBe(0);
  });

  it("counts an evaluation cut off early as its prompt plus a few seconds of writing, not the whole allowance", async () => {
    const { cutOffEstimator } = await import("./spendBudget");
    const shared = limiter();
    const controller = new AbortController();
    const request = new Request("http://localhost/api/evaluate", { headers: { "x-real-ip": "16.0.0.1" }, signal: controller.signal });
    const worst = worstCaseMicroUsd("claude-opus-5-5", 60_000, 32_000);
    const hold = await reserveBudget(shared, request, null, worst, controller.signal, () => cutOffEstimator("claude-opus-5-5", 60_000, 32_000)(5_000));
    if (hold instanceof Response) throw new Error("refused");
    controller.abort();
    await hold.settle();
    const kept = await shared.counter.add!("spend:2026-11-17:total", 0);
    expect(kept).toBe(worstCaseMicroUsd("claude-opus-5-5", 60_000, 500));
    expect(kept).toBeLessThan(worst / 3);
  });

  it("says the day is over for everyone when it is, even while this address's holds are full", async () => {
    const shared = limiter();
    // Everyone's money really spent, by other addresses.
    for (let index = 0; index < Math.ceil(dailyBudgetUsd.total / dailyBudgetUsd.perIp); index++) {
      await recordSpend(shared, from(`17.0.0.${index}`), "claude-opus-5-5", dollars(dailyBudgetUsd.perIp));
    }
    const refused = await budgetResponse(shared, from("17.0.1.1"));
    expect(await refused?.json()).toMatchObject({ error: { code: "limit_daily" } });
  });

  it("files one issue when 'try in a minute' refusals pile up, and none for a refused second try", async () => {
    const { memoryIssueTracker } = await import("./issues");
    const issues = memoryIssueTracker();
    const shared = limiter();
    const first = await reserveBudget(shared, from("18.0.0.1"), issues, dailyBudgetUsd.perIp * 1_000_000);
    if (first instanceof Response) throw new Error("refused");
    // The second try of that call does not fit: refused quietly.
    expect(await first.holdAnother()).toBe(false);
    expect(issues.issues).toHaveLength(0);
    // Twenty busy refusals of new calls: one issue.
    for (let attempt = 0; attempt < 25; attempt++) await reserveBudget(shared, from("18.0.0.1"), issues, 1);
    expect(issues.issues).toHaveLength(1);
    expect(issues.issues[0].title).toContain("zkus to za minutu");
  });

  it("refuses a person whose limit is used up before holding money: no false 'try in a minute', no alert", async () => {
    const { memoryIssueTracker } = await import("./issues");
    const issues = memoryIssueTracker();
    const content = loadServerContent();
    const role = content.roles.activeRoles.find((task) => task.id === "qa-release")!;
    let calls = 0;
    const claude = { async chat() { calls += 1; return { truncated: false }; } } as unknown as ClaudeClient;
    const shared: RateLimiter = { ...limiter(), limits: { perPerson: { ...dailyLimitsFor(1) }, total: { ...dailyLimitsFor(1) } } };
    const request = () => new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost", "x-real-ip": "19.0.0.1" },
      body: JSON.stringify({ roleId: role.id, transcript: [{ turn: 1, kind: "user", content: "Ahoj", ts: "2026-11-17T10:00:00.000Z" }] }),
    });
    await (await handleChat(request(), { content, claude, limiter: shared, issues })).text();
    const refusals = await Promise.all(Array.from({ length: 40 }, async () => (await (await handleChat(request(), { content, claude, limiter: shared, issues })).json()).error.code));
    expect(new Set(refusals)).toEqual(new Set(["limit_person"]));
    expect(issues.issues).toHaveLength(0);
    expect(await shared.counter.add!("spend:2026-11-17:total", 0)).toBe(await shared.counter.add!("spent:2026-11-17:total", 0));
    expect(calls).toBe(1);
  });
});

function dailyLimitsFor(value: number) {
  return { chat: value, evaluate: value, feedback: value, challenge: value, example: value, stats: value, why: value, customTask: value, customTaskStatus: value, customTaskShare: value };
}

