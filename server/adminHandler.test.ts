import { describe, expect, it } from "vitest";
import { handleAdmin, memoryAdminLog, type AdminDeps, type AdminOverview } from "./adminHandler";
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
  const deps: AdminDeps = { content, limiter: { counter: memoryCounter(), secret: "s", metrics }, feedback, customTasks, issues, adminToken, adminLog };
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

  it("returns the overview: daily metrics, visitors, budget, tasks, feedback and pending shares", async () => {
    const { deps, metrics, customTasks, feedback } = await setup();
    const day = pragueDay(new Date());
    await metrics.add(day, { "screen.home": 4 });
    await metrics.addUnique(day, "visitors", "x");
    await feedback.save({ kind: "note", message: "Super", at: "2026-11-23T10:00:00.000Z" });
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
});
