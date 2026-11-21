import { describe, expect, it } from "vitest";
import { handleCustomTaskShare, handleCustomTaskStatus, shareIssue, type CustomTaskStatusResponse } from "./customTaskShare";
import { memoryCustomTaskStore } from "./customTaskStore";
import { memoryIssueTracker } from "./issues";
import { loadServerContent } from "./content";
import { memoryCounter } from "./rateLimit";
import type { ClaudeClient } from "./claudeClient";
import { sampleGeneratedTask } from "../src/customTask/sampleGeneratedTask";

const content = loadServerContent();
const id = "AbCdEfGhIjKl";

async function setup() {
  const customTasks = memoryCustomTaskStore();
  await customTasks.save({ id, createdAt: "2026-11-21T10:00:00.000Z", input: { role: "x", situation: "y", deliverable: "", data: null }, task: sampleGeneratedTask });
  const issues = memoryIssueTracker();
  const deps = { content, claude: {} as ClaudeClient, limiter: { counter: memoryCounter(), secret: "test" }, issues, customTasks };
  const post = async (path: string, body: unknown) => {
    const request = new Request(`http://localhost${path}`, { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json", origin: "http://localhost" } });
    const response = path.endsWith("share") ? await handleCustomTaskShare(request, deps) : await handleCustomTaskStatus(request, deps);
    return { status: response.status, body: (await response.json()) as CustomTaskStatusResponse };
  };
  return { post, issues, customTasks };
}

describe("custom task sharing", () => {
  it("gives the task to nobody before approval", async () => {
    const { post } = await setup();
    expect((await post("/api/custom-task-status", { id })).body).toEqual({ kind: "ok", status: "none" });
  });

  it("asks once: one issue without the trap, then the status is pending", async () => {
    const { post, issues } = await setup();
    expect((await post("/api/custom-task-share", { id })).body).toEqual({ kind: "ok", status: "pending" });
    expect((await post("/api/custom-task-share", { id })).body).toEqual({ kind: "ok", status: "pending" });
    expect(issues.issues).toHaveLength(1);
    expect(issues.issues[0].body).toContain(`approve ${id}`);
    expect(issues.issues[0].body).not.toContain(sampleGeneratedTask.trap.whatIsWrong);
    expect(issues.issues[0].body).not.toContain("4100");
    expect((await post("/api/custom-task-status", { id })).body).toEqual({ kind: "ok", status: "pending" });
  });

  it("gives an approved task to anyone with the link, without the trap", async () => {
    const { post, customTasks } = await setup();
    const record = (await customTasks.load(id))!;
    await customTasks.save({ ...record, share: { status: "approved", requestedAt: "2026-11-21T11:00:00.000Z", decidedAt: "2026-11-21T12:00:00.000Z" } });
    const { body } = await post("/api/custom-task-status", { id });
    expect(body).toMatchObject({ kind: "ok", status: "approved", task: { title: sampleGeneratedTask.title } });
    expect(JSON.stringify(body)).not.toContain(sampleGeneratedTask.trap.title);
  });

  it("answers missing for an unknown task and refuses a malformed id", async () => {
    const { post } = await setup();
    expect((await post("/api/custom-task-status", { id: "ZZZZZZZZZZZZ" })).body).toEqual({ kind: "missing" });
    expect((await post("/api/custom-task-share", { id: "ZZZZZZZZZZZZ" })).body).toEqual({ kind: "missing" });
    expect((await post("/api/custom-task-status", { id: "../x" })).status).toBe(400);
  });

  it("writes the issue only from what the person saw", () => {
    const issue = shareIssue({ id, createdAt: "", input: { role: "x", situation: "y", deliverable: "", data: "Sloupce: tajne" }, task: sampleGeneratedTask });
    expect(issue.title).toContain(sampleGeneratedTask.title);
    expect(issue.body).not.toContain("tajne");
    expect(issue.body).not.toContain(sampleGeneratedTask.judgmentMarkers[0]);
  });
});
