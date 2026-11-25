import { describe, expect, it, vi } from "vitest";
import { memoryNotifier, notify, slackNotifier } from "./notify";
import { memoryCounter, type RateLimiter } from "./rateLimit";
import { handleFeedback, memoryFeedbackStore } from "./feedback";
import { handleClaudeFailure } from "./claudeFailure";
import { dailyBudgetUsd, recordSpend } from "./spendBudget";
import { handleStats } from "./statsHandler";
import { handleMorning } from "./morningHandler";
import { handleAdmin, memoryAdminLog, memorySummaryCache, type AdminDeps } from "./adminHandler";
import { loadServerContent } from "./content";
import { memoryMetrics } from "./metrics";
import { memoryCustomTaskStore } from "./customTaskStore";

const content = loadServerContent();
const limits = { perPerson: { chat: 5, evaluate: 5, feedback: 5, challenge: 5, example: 5, stats: 5, why: 5, customTask: 5, customTaskStatus: 5, customTaskShare: 5 }, total: { chat: 50, evaluate: 50, feedback: 50, challenge: 50, example: 50, stats: 50, why: 50, customTask: 50, customTaskStatus: 50, customTaskShare: 50 } };

function setup(withSlack = true) {
  let now = new Date("2026-11-23T10:00:00Z");
  const notifier = memoryNotifier();
  const limiter: RateLimiter = { counter: memoryCounter(), secret: "s", limits, now: () => now, notifier: withSlack ? notifier : null, metrics: memoryMetrics() };
  return { limiter, notifier, setTime: (iso: string) => (now = new Date(iso)) };
}

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(`https://role-lab.test${path}`, { method: "POST", headers: { origin: "https://role-lab.test", "content-type": "application/json", "x-real-ip": "1.1.1.1", ...headers }, body: JSON.stringify(body) });

describe("Slack notifications", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});

  it("sends one message of a kind an hour, with a plain link to the admin", async () => {
    const { limiter, notifier, setTime } = setup();
    await notify(limiter, "share", "A");
    await notify(limiter, "share", "B");
    await notify(limiter, "feedback", "C");
    expect(notifier.messages.map((message) => message.text)).toEqual(["A", "C"]);
    // The public address even when the request came to a deployment's own address.
    expect(JSON.stringify(notifier.messages[0].blocks)).toContain("<https://role-lab-gamma.vercel.app/?admin|Otevřít admin →>");
    // No button: Slack would show a warning, because nobody answers its click report.
    expect(JSON.stringify(notifier.messages[0].blocks)).not.toContain("button");
    setTime("2026-11-23T11:00:00Z");
    await notify(limiter, "share", "D");
    expect(notifier.messages).toHaveLength(3);
  });

  it("does nothing without Slack and never fails the request when Slack is down", async () => {
    const quiet = setup(false);
    await notify(quiet.limiter, "share", "A");
    expect(quiet.notifier.messages).toHaveLength(0);

    const { limiter } = setup();
    limiter.notifier = { post: async () => Promise.reject(new Error("Slack webhook answered 500")) };
    await expect(notify(limiter, "share", "A")).resolves.toBeUndefined();
  });

  it("reports only Slack's status, not its answer", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("secret details", { status: 403 }));
    await expect(slackNotifier("https://hooks.slack.test/x").post({ text: "A" })).rejects.toThrow("Slack webhook answered 403");
    fetchMock.mockRestore();
  });

  it("tells about feedback by its kind only, never its text or contact", async () => {
    const { limiter, notifier } = setup();
    await handleFeedback(post("/api/feedback", { message: "Tajná poznámka", contact: "jana@example.com" }), { feedback: memoryFeedbackStore(), limiter });
    expect(notifier.messages).toHaveLength(1);
    expect(notifier.messages[0].text).toContain("vzkaz");
    expect(JSON.stringify(notifier.messages)).not.toMatch(/Tajná|jana@/);
  });

  it("warns once a day when spending passes 70 % of the ceiling", async () => {
    const { limiter, notifier } = setup();
    const dollars = (amount: number) => ({ input_tokens: 0, output_tokens: Math.round((amount * 1_000_000) / 20) });
    await recordSpend(limiter, post("/api/chat", {}, { "x-real-ip": "1.1.1.1" }), "claude-opus-5-5", dollars(dailyBudgetUsd.total * 0.5));
    expect(notifier.messages).toHaveLength(0);
    await recordSpend(limiter, post("/api/chat", {}, { "x-real-ip": "2.2.2.2" }), "claude-opus-5-5", dollars(dailyBudgetUsd.total * 0.25));
    await recordSpend(limiter, post("/api/chat", {}, { "x-real-ip": "3.3.3.3" }), "claude-opus-5-5", dollars(0.01));
    expect(notifier.messages).toHaveLength(1);
    expect(notifier.messages[0].text).toContain("70 %");
  });

  it("tells about failing model calls, a wrong admin token and page errors", async () => {
    const { limiter, notifier } = setup();
    await handleClaudeFailure({ limiter }, "chat", post("/api/chat", {}), { code: "overloaded", message: "529" }, () => new Date());
    await handleStats(post("/api/stats", { event: "client_error", id: "render" }), { content, limiter });
    const adminDeps: AdminDeps = { content, limiter, feedback: memoryFeedbackStore(), customTasks: memoryCustomTaskStore(), adminToken: "a".repeat(40), adminLog: memoryAdminLog() };
    await handleAdmin(post("/api/admin", { action: "overview" }, { authorization: `Bearer ${"b".repeat(40)}` }), adminDeps);
    const texts = notifier.messages.map((message) => message.text).join("\n");
    expect(texts).toContain("Volání modelu selhává");
    expect(texts).toContain("chyba");
    expect(texts).toContain("Neúspěšné přihlášení");
    expect(texts).not.toContain("1.1.1.1");
  });
});

describe("the morning message", () => {
  const secret = "c".repeat(32);
  const morning = (deps: AdminDeps & { cronSecret: string | undefined }, bearer?: string) =>
    handleMorning(new Request("https://role-lab.test/api/cron-morning", { headers: bearer ? { authorization: `Bearer ${bearer}` } : {} }), deps);
  const morningDeps = (limiter: RateLimiter, cronSecret: string | undefined = secret): AdminDeps & { cronSecret: string | undefined } => ({
    content,
    limiter,
    feedback: memoryFeedbackStore(),
    customTasks: memoryCustomTaskStore(),
    adminToken: "a".repeat(40),
    adminLog: memoryAdminLog(),
    summaryCache: memorySummaryCache(),
    claude: { evaluateChallenge: async () => JSON.stringify({ headline: "Klidný týden.", details: "Málo dat." }) } as AdminDeps["claude"],
    cronSecret,
  });

  it("refuses anyone without the cron secret, and works only with a long enough one", async () => {
    const { limiter, notifier } = setup();
    expect((await morning(morningDeps(limiter))).status).toBe(401);
    expect((await morning(morningDeps(limiter), "d".repeat(32))).status).toBe(401);
    expect((await morning(morningDeps(limiter, "short"), "short")).status).toBe(401);
    expect((await morning({ ...morningDeps(limiter), cronSecret: undefined }, secret)).status).toBe(401);
    expect(notifier.messages).toHaveLength(0);
  });

  it("does nothing without Slack", async () => {
    const { limiter } = setup(false);
    expect(await (await morning(morningDeps(limiter), secret)).json()).toMatchObject({ skipped: expect.any(String) });
  });

  it("posts the AI summary, yesterday's numbers and what needs attention", async () => {
    const { limiter, notifier } = setup();
    const response = await morning(morningDeps(limiter), secret);
    expect(await response.json()).toEqual({ posted: true });
    expect(notifier.messages).toHaveLength(1);
    const text = notifier.messages[0].text;
    expect(text).toContain("ranní přehled");
    expect(text).toContain("Klidný týden.");
    expect(text).toContain("Včera: 0 návštěvníků");
    expect(text).toContain("Co řešit");
  });

  it("still posts the numbers when the summary cannot be written", async () => {
    const { limiter, notifier } = setup();
    const deps = morningDeps(limiter);
    deps.claude = { evaluateChallenge: async () => "not json" } as AdminDeps["claude"];
    await morning(deps, secret);
    expect(notifier.messages[0].text).toContain("Shrnutí se dnes nepodařilo napsat");
    expect(notifier.messages[0].text).toContain("Včera:");
  });

  it("posts at most five morning messages a day, so a leaked secret cannot flood Slack", async () => {
    const { limiter, notifier } = setup();
    const results = [];
    for (let round = 0; round < 7; round++) results.push(await (await morning(morningDeps(limiter), secret)).json());
    expect(notifier.messages).toHaveLength(5);
    expect(results.at(-1)).toMatchObject({ skipped: expect.any(String) });
  });

  it("deletes feedback older than 90 days every morning, even without Slack", async () => {
    const { limiter } = setup(false);
    const deps = morningDeps(limiter);
    const store = deps.feedback as ReturnType<typeof memoryFeedbackStore>;
    store.entries.push({ kind: "note", message: "stará", contact: "a@b.cz", at: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString() });
    await morning(deps, secret);
    expect(store.entries).toHaveLength(0);
  });
});
