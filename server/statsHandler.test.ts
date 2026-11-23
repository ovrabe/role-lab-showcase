import { describe, expect, it } from "vitest";
import { countCustomTask, handleStats } from "./statsHandler";
import { loadServerContent } from "./content";
import { memoryCounter, type RateLimiter } from "./rateLimit";
import { memoryIssueTracker } from "./issues";
import { memoryMetrics, pragueDay } from "./metrics";
import { dailyVisitorMark } from "./pageEvents";

const content = loadServerContent();
const task = content.roles.activeRoles[0];
const challenge = content.challenges.challenges[0];
const post = (body: unknown) =>
  new Request("http://localhost/api/stats", { method: "POST", headers: { origin: "http://localhost", "content-type": "application/json" }, body: JSON.stringify(body) });

function setup() {
  let now = new Date("2026-11-17T10:00:00Z");
  const limiter: RateLimiter = { counter: memoryCounter(), secret: "s", now: () => now };
  const issues = memoryIssueTracker();
  return { deps: { content, limiter, issues }, issues, setDay: (iso: string) => (now = new Date(iso)) };
}

describe("anonymous statistics", () => {
  it("accepts the four events for real tasks and challenges only", async () => {
    const { deps } = setup();
    expect((await handleStats(post({ event: "task_started", id: task.id }), deps)).status).toBe(200);
    expect((await handleStats(post({ event: "challenge_evaluated", id: challenge.id }), deps)).status).toBe(200);
    expect((await handleStats(post({ event: "task_started", id: "vymysleny-ukol" }), deps)).status).toBe(400);
    expect((await handleStats(post({ event: "page_viewed", id: task.id }), deps)).status).toBe(400);
  });

  it("files yesterday's totals once, on the first event of the next day", async () => {
    const { deps, issues, setDay } = setup();
    for (const event of ["task_started", "task_started", "task_submitted", "task_evaluated"]) await handleStats(post({ event, id: task.id }), deps);
    await handleStats(post({ event: "challenge_evaluated", id: challenge.id }), deps);
    // 17 November itself only had its own (empty) yesterday, so nothing was filed.
    expect(issues.issues).toHaveLength(0);

    setDay("2026-11-18T08:00:00Z");
    await handleStats(post({ event: "task_started", id: task.id }), deps);
    await handleStats(post({ event: "task_started", id: task.id }), deps);
    expect(issues.issues).toHaveLength(1);
    const [issue] = issues.issues;
    expect(issue.title).toBe("Statistika za 17. 11. 2026");
    expect(issue.body).toContain(`| ${task.title}: ${task.taskTitle} | 2 | 1 | 1 |`);
    expect(issue.body).toContain("Ohodnocené výzvy: 1.");
    expect(issue.labels).toEqual(["statistika"]);
  });

  it("counts custom tasks together, without ids, and reports them the next day", async () => {
    const { deps, issues, setDay } = setup();
    await countCustomTask(deps.limiter, "generated");
    await countCustomTask(deps.limiter, "generated");
    await countCustomTask(deps.limiter, "evaluated");
    await countCustomTask(deps.limiter, "shared");
    setDay("2026-11-18T08:00:00Z");
    await handleStats(post({ event: "task_started", id: task.id }), deps);
    expect(issues.issues[0].body).toContain("Vlastní výzvy: vygenerováno 2, ohodnoceno 1, žádostí o sdílení 1.");
  });

  describe("page events for the admin page", () => {
    function withMetrics() {
      const metrics = memoryMetrics();
      const limiter: RateLimiter = { counter: memoryCounter(), secret: "s", metrics };
      return { deps: { content, limiter, issues: null }, metrics, day: pragueDay(new Date()) };
    }
    const visit = (body: unknown, agent = "Firefox", ip = "10.0.0.1") =>
      new Request("http://localhost/api/stats", {
        method: "POST",
        headers: { origin: "http://localhost", "content-type": "application/json", "user-agent": agent, "x-real-ip": ip },
        body: JSON.stringify(body),
      });

    it("counts screens, task steps, attempts, score changes and errors as fixed names", async () => {
      const { deps, metrics, day } = withMetrics();
      for (const body of [
        { event: "screen_view", id: "home" },
        { event: "task_step", id: task.id, step: "first_message" },
        { event: "task_started", id: "custom" },
        { event: "attempt", id: task.id, attempt: 2, levelChange: 1 },
        { event: "review_change", id: task.id, dimension: "verification", direction: "down" },
        { event: "client_error", id: "render" },
        { event: "tour_completed", id: "tour" },
      ]) expect((await handleStats(post(body), deps)).status).toBe(200);
      expect(await metrics.readDay(day)).toEqual({
        "screen.home": 1,
        [`funnel.${task.id}.first_message`]: 1,
        "funnel.custom.started": 1,
        [`progress.${task.id}.attempt.2`]: 1,
        [`progress.${task.id}.level_change.1`]: 1,
        [`review.${task.id}.verification.down`]: 1,
        "client_error.render": 1,
        "tour.completed": 1,
      });
    });

    it("refuses anything outside the fixed lists", async () => {
      const { deps } = withMetrics();
      for (const body of [
        { event: "screen_view", id: "<script>" },
        { event: "task_step", id: "vymysleny", step: "first_message" },
        { event: "task_step", id: task.id, step: "napsal Jan Novák" },
        { event: "attempt", id: task.id, attempt: 2, levelChange: 9 },
        { event: "review_change", id: task.id, dimension: "nic", direction: "up" },
      ]) expect((await handleStats(post(body), deps)).status).toBe(400);
    });

    it("counts unique visitors of a day without keeping who they were", async () => {
      const { deps, metrics, day } = withMetrics();
      await handleStats(visit({ event: "screen_view", id: "home" }), deps);
      await handleStats(visit({ event: "screen_view", id: "task" }), deps);
      await handleStats(visit({ event: "screen_view", id: "home" }, "Safari", "10.0.0.2"), deps);
      expect(await metrics.countUnique(day, "visitors")).toBe(2);
      // The mark changes every day, so one person cannot be followed across days.
      const request = visit({});
      expect(dailyVisitorMark(request, "s", "2026-11-23")).not.toBe(dailyVisitorMark(request, "s", "2026-11-24"));
      expect(dailyVisitorMark(request, "s", "2026-11-23")).not.toContain("10.0.0.1");
    });
  });
});
