import { describe, expect, it } from "vitest";
import { handleChat, handleEvaluate, type EvaluateResponse } from "./handlers";
import { loadServerContent } from "./content";
import { memoryCounter } from "./rateLimit";
import { memoryCustomTaskStore } from "./customTaskStore";
import { mockClaude } from "./mockClaude";
import type { ClaudeClient } from "./claudeClient";
import type { ChatTurn } from "../src/assistant/promptBudget";
import type { TaskSession, TranscriptItem } from "../src/session/sessionSchema";
import { sampleGeneratedTask } from "../src/customTask/sampleGeneratedTask";
import { customTaskConfigId } from "../src/customTask/customTaskRole";

// Solving a generated custom task (docs/SPEC.md, section 14): the page sends only "custom-<id>",
// the server loads the task, its materials and its key from the store.

const content = loadServerContent();
const customTaskId = "AbCdEfGhIjKl";
const roleId = customTaskConfigId(customTaskId);

async function setup() {
  const customTasks = memoryCustomTaskStore();
  await customTasks.save({ id: customTaskId, createdAt: "2026-11-21T10:00:00.000Z", input: { role: "x", situation: "y", deliverable: "", data: null }, task: sampleGeneratedTask });
  const sent: { turns?: ChatTurn[]; prompt?: string } = {};
  const claude: ClaudeClient = {
    ...mockClaude,
    async chat(turns, options) {
      sent.turns = turns;
      return mockClaude.chat(turns, options);
    },
    async evaluate(prompt, options) {
      sent.prompt = prompt;
      return mockClaude.evaluate(prompt, options);
    },
  };
  return { deps: { content, claude, limiter: { counter: memoryCounter(), secret: "test" }, customTasks }, sent };
}

const post = (path: string, body: unknown) =>
  new Request(`http://localhost${path}`, { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json", origin: "http://localhost" } });

const ts = "2026-11-21T10:05:00.000Z";
const transcript: TranscriptItem[] = [
  { turn: 1, kind: "event", event: "data_attached", materialId: "tabulka", content: "Přiložen podklad", ts },
  { turn: 2, kind: "user", content: "Zkontroluj, jestli v tabulce nejsou neobvyklé hodnoty, a navrhni objednávku na prosinec.", ts },
];

describe("custom task: chat", () => {
  it("gives the assistant the generated table when attached, but never the trap", async () => {
    const { deps, sent } = await setup();
    const response = await handleChat(post("/api/chat", { roleId, transcript }), deps);
    expect(response.status).toBe(200);
    await response.text();
    const sentText = JSON.stringify(sent.turns);
    expect(sentText).toContain("Kapky do očí");
    expect(sentText).toContain(sampleGeneratedTask.roleTitle);
    expect(sentText).not.toContain(sampleGeneratedTask.trap.title);
    expect(sentText).not.toContain(sampleGeneratedTask.trap.whatIsWrong);
  });

  it("refuses an unknown or malformed id and a material the task does not have", async () => {
    const { deps } = await setup();
    expect((await handleChat(post("/api/chat", { roleId: customTaskConfigId("ZZZZZZZZZZZZ"), transcript }), deps)).status).toBe(400);
    expect((await handleChat(post("/api/chat", { roleId: "custom-../../x", transcript }), deps)).status).toBe(400);
    const foreign = [{ ...transcript[0], materialId: "prodeje" }, transcript[1]];
    expect((await handleChat(post("/api/chat", { roleId, transcript: foreign }), deps)).status).toBe(400);
  });

  it("does not work without the store", async () => {
    const { deps } = await setup();
    const { customTasks: _store, ...withoutStore } = deps;
    expect((await handleChat(post("/api/chat", { roleId, transcript }), withoutStore)).status).toBe(400);
  });
});

describe("custom task: evaluation", () => {
  const session: TaskSession = {
    version: 1,
    roleId,
    startedAt: "2026-11-21T10:00:00.000Z",
    transcript: [...transcript, { turn: 3, kind: "assistant", content: "Kapky do očí mají v listopadu výkyv.", ts }],
    submission: "Objednávka na prosinec: kapky do očí podle průměru září a října, listopadový výkyv nepočítám.",
    reflection: "",
    lastSavedSubmission: "",
    submittedAt: "2026-11-21T10:14:00.000Z",
  };

  it("evaluates with the generic rubric and the generated key, and reveals the trap only afterwards", async () => {
    const { deps, sent } = await setup();
    const body = (await (await handleEvaluate(post("/api/evaluate", { roleId, session }), deps)).json()) as EvaluateResponse;
    expect(body.kind).toBe("ok");
    if (body.kind !== "ok") return;
    expect(sent.prompt).toContain(sampleGeneratedTask.trap.whatIsWrong);
    expect(sent.prompt).toContain("Postupuje logicky: projde data");
    expect(sent.prompt).toContain(sampleGeneratedTask.judgmentMarkers[0]);
    expect(body.evaluation.keyTraps).toEqual([expect.objectContaining({ id: "T1_past", title: sampleGeneratedTask.trap.title })]);
  });

  it("refuses a session of another task", async () => {
    const { deps } = await setup();
    const response = await handleEvaluate(post("/api/evaluate", { roleId, session: { ...session, roleId: "category-manager" } }), deps);
    expect(response.status).toBe(400);
  });
});
