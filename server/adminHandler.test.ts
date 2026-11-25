import { describe, expect, it, vi } from "vitest";
import { handleAdmin, memoryAdminLog, memorySummaryCache, upstashAdminLog, type AdminDeps, type AdminOverview } from "./adminHandler";
import { loadServerContent } from "./content";
import { memoryCounter } from "./rateLimit";
import { memoryMetrics, pragueDay } from "./metrics";
import { memoryFeedbackStore } from "./feedback";
import { memoryCustomTaskStore } from "./customTaskStore";
import { memoryIssueTracker } from "./issues";
import { sampleGeneratedTask } from "../src/customTask/sampleGeneratedTask";

const content = loadServerContent();
const token = "a".repeat(40);

async function setup(...args: [string | undefined] | []) {
  // setup() uses the test token; setup(undefined) means no token in the settings.
  const adminToken = args.length === 0 ? token : args[0];
  const metrics = memoryMetrics();
  const customTasks = memoryCustomTaskStore();
  const issues = memoryIssueTracker();
  const feedback = memoryFeedbackStore();
  const adminLog = memoryAdminLog();
  const deps: AdminDeps = { content, limiter: { counter: memoryCounter(), secret: "s", metrics }, feedback, customTasks, issues, adminToken, adminLog, summaryCache: memorySummaryCache() };
  return { deps, metrics, customTasks, issues, feedback, adminLog };
}

const call = (deps: AdminDeps, body: unknown, bearer: string | null = token, origin = "http://localhost") =>
  handleAdmin(
    new Request("http://localhost/api/admin", {
      method: "POST",
      headers: { origin, "content-type": "application/json", ...(bearer === null ? {} : { authorization: `Bearer ${bearer}` }), "x-real-ip": "10.1.1.1" },
      body: JSON.stringify(body),
    }),
    deps,
  );

describe("/api/admin", () => {
  it("does not exist without a long enough token in the settings", async () => {
    for (const configured of [undefined, "", "short-token"]) {
      const { deps } = await setup(configured);
      expect((await call(deps, { action: "overview" }, configured ?? "")).status).toBe(404);
    }
  });

  it("refuses a wrong or missing token and another page", async () => {
    const { deps } = await setup();
    expect((await call(deps, { action: "overview" }, "b".repeat(40))).status).toBe(401);
    expect((await call(deps, { action: "overview" }, null)).status).toBe(401);
    expect((await call(deps, { action: "overview" }, token, "https://evil.test")).status).toBe(403);
  });

  it("blocks an address after 10 wrong tokens a day, even with the right one, and alerts once", async () => {
    const { deps, issues } = await setup();
    for (let attempt = 0; attempt < 10; attempt++) expect((await call(deps, { action: "overview" }, `wrong-${attempt}`)).status).toBe(401);
    expect((await call(deps, { action: "overview" })).status).toBe(429);
    expect(issues.issues).toHaveLength(1);
    expect(issues.issues[0].body).not.toContain("10.1.1.1");
  });

  it("counts attempts sent at the same moment, so 50 at once cannot all try a token", async () => {
    const { deps } = await setup();
    const statuses = await Promise.all(Array.from({ length: 50 }, (_, index) => call(deps, { action: "overview" }, `wrong-${index}`).then((response) => response.status)));
    expect(statuses.filter((status) => status === 401)).toHaveLength(10);
    expect(statuses.filter((status) => status === 429)).toHaveLength(40);
  });

  it("never locks the author out with their own parallel requests, even after 9 wrong tokens", async () => {
    const { deps } = await setup();
    for (let attempt = 0; attempt < 9; attempt++) expect((await call(deps, { action: "overview" }, `wrong-${attempt}`)).status).toBe(401);
    const statuses = await Promise.all(Array.from({ length: 5 }, () => call(deps, { action: "overview" }).then((response) => response.status)));
    expect(statuses).toEqual([200, 200, 200, 200, 200]);
    expect((await call(deps, { action: "overview" })).status).toBe(200);
  });

  it("does not use up attempts with the right token", async () => {
    const { deps } = await setup();
    for (let round = 0; round < 15; round++) expect((await call(deps, { action: "overview" })).status).toBe(200);
    for (let attempt = 0; attempt < 10; attempt++) expect((await call(deps, { action: "overview" }, `wrong-${attempt}`)).status).toBe(401);
  });

  it("returns the overview: daily metrics, visitors, budget, tasks, feedback and pending shares", async () => {
    const { deps, metrics, customTasks, feedback } = await setup();
    const day = pragueDay(new Date());
    await metrics.add(day, { "screen.home": 4 });
    await metrics.addUnique(day, "visitors", "x");
    // Now, not a fixed date: notes older than 90 days are dropped (server/feedback.ts).
    await feedback.save({ kind: "note", message: "Super", at: new Date().toISOString() });
    await customTasks.save({ id: "AbCdEfGhIjKl", createdAt: "2026-11-23T09:00:00.000Z", input: { role: "x", situation: "y", deliverable: "", data: null }, task: sampleGeneratedTask });
    await customTasks.requestShare("AbCdEfGhIjKl", "2026-11-23T09:30:00.000Z");
    const response = await call(deps, { action: "overview", days: 7 });
    expect(response.status).toBe(200);
    const body = (await response.json()) as AdminOverview;
    expect(body.days).toHaveLength(7);
    expect(body.days[0]).toEqual({ day, metrics: { "screen.home": 4 }, visitors: 1 });
    expect(body.tasks.length).toBeGreaterThan(20);
    expect(body.feedback[0]).toMatchObject({ message: "Super" });
    expect(body.pendingShares).toEqual([expect.objectContaining({ id: "AbCdEfGhIjKl", title: sampleGeneratedTask.title, trap: sampleGeneratedTask.trap.whatIsWrong })]);
    expect(body.generationOff).toBe(false);
  });

  it("approves a share and switches generation off, and logs both", async () => {
    const { deps, customTasks, adminLog } = await setup();
    await customTasks.save({ id: "AbCdEfGhIjKl", createdAt: "2026-11-23T09:00:00.000Z", input: { role: "x", situation: "y", deliverable: "", data: null }, task: sampleGeneratedTask });
    await customTasks.requestShare("AbCdEfGhIjKl", "2026-11-23T09:30:00.000Z");
    expect((await call(deps, { action: "decide_share", id: "AbCdEfGhIjKl", decision: "approved" })).status).toBe(200);
    expect((await customTasks.load("AbCdEfGhIjKl"))?.share?.status).toBe("approved");
    expect(await customTasks.listPending()).toHaveLength(0);
    expect((await call(deps, { action: "decide_share", id: "ZZZZZZZZZZZZ", decision: "approved" })).status).toBe(404);
    expect((await call(deps, { action: "generation", off: true })).status).toBe(200);
    expect(await customTasks.isGenerationOff()).toBe(true);
    expect((await adminLog.recent(10)).map((entry) => entry.action)).toEqual(["generation_off", "share_approved"]);
  });

  it("refuses unknown actions and malformed ids", async () => {
    const { deps } = await setup();
    expect((await call(deps, { action: "delete_everything" })).status).toBe(400);
    expect((await call(deps, { action: "decide_share", id: "../x", decision: "approved" })).status).toBe(400);
  });

  it("writes the AI summary from totals only, keeps it for the day, and refreshes on request", async () => {
    const { deps, metrics } = await setup();
    await metrics.add(pragueDay(new Date()), { "screen.home": 4, "funnel.qa.started": 2 });
    const prompts: string[] = [];
    deps.claude = { evaluateChallenge: async (prompt: string) => (prompts.push(prompt), JSON.stringify({ headline: "Klid.", details: "Málo dat." })) } as AdminDeps["claude"];
    const first = await (await call(deps, { action: "summary", days: 7 })).json();
    expect(first).toEqual({ headline: "Klid.", details: "Málo dat.", cached: false });
    expect(prompts[0]).toContain('"started":2');
    expect(await (await call(deps, { action: "summary", days: 7 })).json()).toMatchObject({ cached: true });
    expect(prompts).toHaveLength(1);
    await call(deps, { action: "summary", days: 7, refresh: true });
    expect(prompts).toHaveLength(2);
  });

  it("returns the previous period for trends", async () => {
    const { deps } = await setup();
    const body = (await (await call(deps, { action: "overview", days: 7 })).json()) as AdminOverview;
    expect(body.previousDays).toHaveLength(7);
    expect(body.previousDays[0].day < body.days.at(-1)!.day).toBe(true);
  });

  it("answers a question about the data from totals only, within a daily limit", async () => {
    const { deps, metrics, feedback } = await setup();
    await metrics.add(pragueDay(new Date()), { "funnel.qa-release.started": 3 });
    await feedback.save({ kind: "note", message: "Tajný vzkaz", contact: "jana@firma.cz", at: new Date().toISOString() });
    const sent: string[] = [];
    deps.claude = {
      async chat(turns, { onDelta }) {
        sent.push(turns[0].content);
        onDelta("Odpadají ");
        onDelta("na začátku.");
        return { truncated: false };
      },
    };
    const response = await call(deps, { action: "ask", days: 7, question: "Kde lidé odpadají?" });
    expect(await response.json()).toEqual({ answer: "Odpadají na začátku." });
    expect(sent[0]).toContain("<otazka>Kde lidé odpadají?</otazka>");
    expect(sent[0]).toContain('"zacato":3');
    // Feedback texts and contacts never reach the model.
    expect(sent[0]).not.toContain("Tajný vzkaz");
    expect(sent[0]).not.toContain("jana@firma.cz");
    expect((await call(deps, { action: "ask", days: 7, question: "?" })).status).toBe(400);
  });

  it("keeps the author's AI calls out of the testers' budget and caps them together at 50 a day", async () => {
    const { deps, metrics } = await setup();
    deps.claude = {
      evaluateChallenge: async (_prompt, options) => (await options.onUsage?.("claude-haiku-5-5", { input_tokens: 1000, output_tokens: 100 }), JSON.stringify({ headline: "A", details: "B" })),
      async chat(_turns, { onDelta, onUsage }) {
        await onUsage?.("claude-sonnet-5-5", { input_tokens: 10000, output_tokens: 500 });
        onDelta("Odpověď.");
        return { truncated: false };
      },
    };
    expect((await call(deps, { action: "summary", days: 7 })).status).toBe(200);
    expect((await call(deps, { action: "ask", days: 7, question: "Jak to jde?" })).status).toBe(200);
    // Measured in the metrics...
    const day = await metrics.readDay(pragueDay(new Date()));
    expect(day["spend.adminAsk.claude-sonnet-5-5"]).toBeGreaterThan(0);
    // ...but not in the testers' daily budget.
    expect(await deps.limiter.counter.add!(`spend:${pragueDay(new Date())}:total`, 0)).toBe(0);
    for (let index = 2; index < 50; index++) await call(deps, { action: "ask", days: 7, question: "Další?" });
    expect((await call(deps, { action: "ask", days: 7, question: "Ještě?" })).status).toBe(429);
    // A cached summary still opens.
    expect((await call(deps, { action: "summary", days: 7 })).status).toBe(200);
  });
});

describe("the admin log in Upstash", () => {
  it("skips a damaged entry instead of breaking the whole overview", async () => {
    const good = JSON.stringify({ at: "2026-11-24T10:00:00.000Z", action: "share_approved", taskId: "abc" });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify([{ result: [good, "{ nedokončené"] }]))));
    expect(await upstashAdminLog("https://example.upstash.io", "t").recent(10)).toHaveLength(1);
    vi.unstubAllGlobals();
  });
});
