import { describe, expect, it } from "vitest";
import { countCustomTask, handleStats } from "./statsHandler";
import { loadServerContent } from "./content";
import { memoryCounter, type RateLimiter } from "./rateLimit";
import { memoryIssueTracker } from "./issues";

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
});
