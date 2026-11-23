import { afterEach, describe, expect, it, vi } from "vitest";
import { handleChat, handleEvaluate } from "./handlers";
import { loadServerContent } from "./content";
import { memoryCounter, upstashCounter, type Counter, type RateLimiter } from "./rateLimit";
import type { ClaudeClient } from "./claudeClient";
import { loadPreviewSamples } from "../src/evaluation/previewFixture";

const content = loadServerContent();
// The original task: it has sample evaluations, the newer tasks get theirs after calibration.
const role = content.roles.activeRoles.find((task) => task.id === "category-manager")!;
const session = loadPreviewSamples(role).find((sample) => sample.id === "strong")!.session;

// Small limits so the tests stay short; the real numbers are in dailyLimits.
const smallLimits = { perPerson: { chat: 2, evaluate: 1, feedback: 1, challenge: 1, example: 1, stats: 1, why: 1, customTask: 1, customTaskStatus: 1, customTaskShare: 1 }, total: { chat: 3, evaluate: 2, feedback: 2, challenge: 1, example: 1, stats: 1, why: 1, customTask: 1, customTaskStatus: 1, customTaskShare: 1 } };

function countingClaude() {
  const calls = { chat: 0, evaluate: 0 };
  const claude: ClaudeClient = {
    async chat(_turns, { onDelta }) {
      calls.chat += 1;
      onDelta("ok");
      return { truncated: false };
    },
    async evaluateChallenge() {
      return "";
    },
    async evaluate() {
      calls.evaluate += 1;
      return JSON.stringify(session.evaluation!.output);
    },
  };
  return { claude, calls };
}

function setup(counter: Counter = memoryCounter(), now = () => new Date("2026-11-11T10:00:00Z")) {
  const { claude, calls } = countingClaude();
  const limiter: RateLimiter = { counter, secret: "test-secret", limits: smallLimits, now };
  return { deps: { content, claude, limiter }, calls, limiter };
}

const chatFrom = (ip: string) =>
  new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json", "x-real-ip": ip, origin: "http://localhost" },
    body: JSON.stringify({ roleId: role.id, transcript: [{ turn: 1, kind: "user", content: "Ahoj", ts: "2026-11-11T10:00:00.000Z" }] }),
  });

const evaluateFrom = (ip: string) =>
  new Request("http://localhost/api/evaluate", {
    method: "POST",
    headers: { "content-type": "application/json", "x-real-ip": ip, origin: "http://localhost" },
    body: JSON.stringify({ roleId: role.id, session }),
  });

async function errorCode(response: Response): Promise<string | undefined> {
  return ((await response.json()) as { error?: { code?: string } }).error?.code;
}

describe("daily limits", () => {
  it("stops one person after their chat limit, without calling Claude", async () => {
    const { deps, calls } = setup();
    expect((await handleChat(chatFrom("1.1.1.1"), deps)).status).toBe(200);
    expect((await handleChat(chatFrom("1.1.1.1"), deps)).status).toBe(200);
    const third = await handleChat(chatFrom("1.1.1.1"), deps);
    expect(third.status).toBe(429);
    expect(await errorCode(third)).toBe("limit_person");
    expect(calls.chat).toBe(2);
  });

  it("counts each person separately, up to the shared daily ceiling", async () => {
    const { deps } = setup();
    await handleChat(chatFrom("1.1.1.1"), deps);
    await handleChat(chatFrom("1.1.1.1"), deps);
    expect((await handleChat(chatFrom("2.2.2.2"), deps)).status).toBe(200);
    // Total chat limit is 3: the fourth message of the day is refused for anyone.
    const fourth = await handleChat(chatFrom("3.3.3.3"), deps);
    expect(fourth.status).toBe(429);
    expect(await errorCode(fourth)).toBe("limit_daily");
  });

  it("limits evaluations per person and in total", async () => {
    const { deps, calls } = setup();
    expect((await handleEvaluate(evaluateFrom("1.1.1.1"), deps)).status).toBe(200);
    expect(await errorCode(await handleEvaluate(evaluateFrom("1.1.1.1"), deps))).toBe("limit_person");
    expect((await handleEvaluate(evaluateFrom("2.2.2.2"), deps)).status).toBe(200);
    expect(await errorCode(await handleEvaluate(evaluateFrom("3.3.3.3"), deps))).toBe("limit_daily");
    expect(calls.evaluate).toBe(2);
  });

  it("starts again the next day in Czech time", async () => {
    let now = new Date("2026-11-11T22:30:00Z"); // 23:30 in Prague
    const { deps } = setup(memoryCounter(), () => now);
    await handleChat(chatFrom("1.1.1.1"), deps);
    await handleChat(chatFrom("1.1.1.1"), deps);
    expect((await handleChat(chatFrom("1.1.1.1"), deps)).status).toBe(429);
    now = new Date("2026-11-11T23:05:00Z"); // 00:05 in Prague, still the 11th in UTC
    expect((await handleChat(chatFrom("1.1.1.1"), deps)).status).toBe(200);
  });

  it("does not count requests that fail the input checks", async () => {
    const { deps } = setup();
    const broken = () => new Request("http://localhost/api/chat", { method: "POST", headers: { "x-real-ip": "1.1.1.1", origin: "http://localhost" }, body: "{nope" });
    for (let i = 0; i < 5; i++) expect((await handleChat(broken(), deps)).status).toBe(400);
    expect((await handleChat(chatFrom("1.1.1.1"), deps)).status).toBe(200);
  });

  it("refuses to call Claude when the counter store is down", async () => {
    const failing: Counter = { increment: async () => Promise.reject(new Error("store down")) };
    const { deps, calls } = setup(failing);
    vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await handleChat(chatFrom("1.1.1.1"), deps);
    expect(response.status).toBe(503);
    expect(calls.chat).toBe(0);
  });

  it("never stores the IP address itself", async () => {
    const keys: string[] = [];
    const recording: Counter = {
      async increment(key) {
        keys.push(key);
        return 1;
      },
    };
    const { deps } = setup(recording);
    await handleChat(chatFrom("203.0.113.7"), deps);
    expect(keys.length).toBeGreaterThan(0);
    expect(keys.join(" ")).not.toContain("203.0.113.7");
  });
});

describe("upstashCounter", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends INCR and EXPIRE as one transaction and returns the count", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify([{ result: 3 }, { result: 1 }])));
    vi.stubGlobal("fetch", fetchMock);
    const value = await upstashCounter("https://example.upstash.io/", "token-123").increment("rl:key");
    expect(value).toBe(3);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://example.upstash.io/multi-exec");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer token-123");
    expect(JSON.parse(String(init.body))).toEqual([
      ["INCR", "rl:key"],
      ["EXPIRE", "rl:key", "172800"],
    ]);
  });

  it("throws when the store answers with an error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "ERR" }))));
    await expect(upstashCounter("https://example.upstash.io", "t").increment("k")).rejects.toThrow();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 401 })));
    await expect(upstashCounter("https://example.upstash.io", "t").increment("k")).rejects.toThrow();
  });
});

describe("limits per browser on a shared network", () => {
  const limits = { perPerson: { chat: 1, evaluate: 1, feedback: 1, challenge: 1, example: 1, stats: 1, why: 1, customTask: 1, customTaskStatus: 1, customTaskShare: 1 }, total: { chat: 100, evaluate: 100, feedback: 100, challenge: 100, example: 1, stats: 1, why: 1, customTask: 1, customTaskStatus: 1, customTaskShare: 1 } };
  const limiter = (): RateLimiter => ({ counter: memoryCounter(), secret: "s", limits, now: () => new Date("2026-11-11T10:00:00Z") });
  const browser = (index: number) => `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
  const call = (ip: string, browserId?: string) =>
    new Request("http://localhost/api/chat", { headers: { "x-real-ip": ip, ...(browserId ? { "x-role-lab-browser": browserId } : {}) } });

  it("gives each browser its own limit, even behind one IP address", async () => {
    const { takeFromLimit } = await import("./rateLimit");
    const shared = limiter();
    expect(await takeFromLimit(shared, "chat", call("9.9.9.9", browser(1)))).toBeNull();
    expect(await takeFromLimit(shared, "chat", call("9.9.9.9", browser(1)))).toBe("limit_person");
    expect(await takeFromLimit(shared, "chat", call("9.9.9.9", browser(2)))).toBeNull();
  });

  it("caps one IP address at a few people's worth, so invented numbers do not help a script", async () => {
    const { takeFromLimit } = await import("./rateLimit");
    const shared = limiter();
    for (let index = 1; index <= 4; index++) expect(await takeFromLimit(shared, "chat", call("9.9.9.9", browser(index)))).toBeNull();
    expect(await takeFromLimit(shared, "chat", call("9.9.9.9", browser(5)))).toBe("limit_person");
    expect(await takeFromLimit(shared, "chat", call("8.8.8.8", browser(6)))).toBeNull();
  });

  it("keeps one IP address within a third of the day's total, so it cannot block everyone", async () => {
    const { takeFromLimit, dailyLimits, ipCeiling } = await import("./rateLimit");
    // The real limits: 2 evaluations a person, 15 a day for everyone, so 5 for one address.
    const shared: RateLimiter = { counter: memoryCounter(), secret: "s", now: () => new Date("2026-11-11T10:00:00Z") };
    const evaluate = (ip: string, index: number) => takeFromLimit(shared, "evaluate", new Request("http://localhost/api/evaluate", { headers: { "x-real-ip": ip, "x-role-lab-browser": browser(index) } }));
    // A script inventing a new browser for every call…
    for (let index = 1; index <= 5; index++) expect(await evaluate("9.9.9.9", index)).toBeNull();
    // …stops at the address's third of the day…
    expect(await evaluate("9.9.9.9", 6)).toBe("limit_person");
    // …and people elsewhere can still evaluate.
    expect(await evaluate("8.8.8.8", 7)).toBeNull();
    // Every action keeps at least one person's worth and at most a third of the total.
    for (const action of Object.keys(dailyLimits.perPerson) as (keyof typeof dailyLimits.perPerson)[]) {
      const ceiling = ipCeiling(dailyLimits.perPerson[action], dailyLimits.total[action]);
      expect(ceiling).toBeGreaterThanOrEqual(dailyLimits.perPerson[action]);
      expect(ceiling).toBeLessThanOrEqual(Math.max(dailyLimits.perPerson[action], Math.ceil(dailyLimits.total[action] / 3)));
    }
  });

  it("ignores a malformed number and counts by the IP address", async () => {
    const { takeFromLimit } = await import("./rateLimit");
    const shared = limiter();
    expect(await takeFromLimit(shared, "chat", call("7.7.7.7", "x"))).toBeNull();
    expect(await takeFromLimit(shared, "chat", call("7.7.7.7", "y"))).toBe("limit_person");
  });

  it("gives back every counter it took", async () => {
    const { takeFromLimit, giveBackToLimit } = await import("./rateLimit");
    const shared = limiter();
    await takeFromLimit(shared, "chat", call("9.9.9.9", browser(1)));
    await giveBackToLimit(shared, "chat", call("9.9.9.9", browser(1)));
    expect(await takeFromLimit(shared, "chat", call("9.9.9.9", browser(1)))).toBeNull();
  });
});
