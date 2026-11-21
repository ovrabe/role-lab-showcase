import { describe, expect, it } from "vitest";
import { handleCustomTask, type CustomTaskResponse } from "./customTaskHandler";
import { memoryCustomTaskStore } from "./customTaskStore";
import { loadServerContent } from "./content";
import { memoryCounter } from "./rateLimit";
import type { ClaudeClient } from "./claudeClient";
import { sampleGeneratedTask } from "../src/customTask/sampleGeneratedTask";

const content = loadServerContent();
const body = {
  role: "Nákupčí v síti lékáren",
  situation: "Každý měsíc objednávám volně prodejné léky pro 40 lékáren podle prodejů za tři měsíce.",
  deliverable: "",
  data: "Tabulka „prodeje.csv“, 3 řádky. Sloupce:\n- Lék: text, 3 různé hodnoty",
};

function setup(replies: string[]) {
  const sent: { system: string; user: string }[] = [];
  const claude: ClaudeClient = {
    async chat() {
      return { truncated: false };
    },
    async evaluate() {
      return "";
    },
    async evaluateChallenge() {
      return "";
    },
    async generateCustomTask(prompt) {
      sent.push(prompt);
      return replies.shift() ?? "";
    },
  };
  const counter = memoryCounter();
  const customTasks = memoryCustomTaskStore();
  const deps = { content, claude, limiter: { counter, secret: "test" }, issues: null, customTasks };
  const call = (payload: unknown = body) =>
    handleCustomTask(
      new Request("https://role-lab.test/api/custom-task", {
        method: "POST",
        headers: { origin: "https://role-lab.test", "content-type": "application/json" },
        body: JSON.stringify(payload),
      }),
      deps,
    );
  return { call, sent, customTasks, counter };
}

const good = JSON.stringify(sampleGeneratedTask);

describe("handleCustomTask", () => {
  it("generates, stores and returns the task without the trap", async () => {
    const { call, sent, customTasks } = setup([good]);
    const response = (await (await call()).json()) as CustomTaskResponse;
    expect(response.kind).toBe("ok");
    if (response.kind !== "ok") return;
    expect(JSON.stringify(response.task)).not.toContain(sampleGeneratedTask.trap.title);
    expect(response.id).toMatch(/^[A-Za-z0-9_-]{12}$/);
    const stored = await customTasks.load(response.id);
    expect(stored?.task.trap.cell.value).toBe("4100");
    expect(stored?.input.role).toBe(body.role);
    // The person's text reaches only the message, never the instructions.
    expect(sent[0].user).toContain("Nákupčí v síti lékáren");
    expect(sent[0].system).not.toContain("Nákupčí v síti lékáren");
  });

  it("retries once when the trap is not in the table, then gives up and returns the attempt", async () => {
    const broken = JSON.stringify({ ...sampleGeneratedTask, trap: { ...sampleGeneratedTask.trap, cell: { row: 2, column: "lek", value: "nic" } } });
    const { call, sent } = setup([broken, broken]);
    const response = (await (await call()).json()) as CustomTaskResponse;
    expect(sent).toHaveLength(2);
    expect(response).toMatchObject({ kind: "invalid", problems: expect.arrayContaining(["trap_cell_value"]) });
    // The attempt was given back: the same person can try again today.
    const again = setup([good]);
    expect((await (await again.call()).json()).kind).toBe("ok");
  });

  it("succeeds on the second try when the first reply is broken JSON", async () => {
    const { call, sent } = setup(["not json", good]);
    expect(((await (await call()).json()) as CustomTaskResponse).kind).toBe("ok");
    expect(sent).toHaveLength(2);
  });

  it("allows one task per person and day", async () => {
    const { call } = setup([good, good]);
    expect((await call()).status).toBe(200);
    const second = await call();
    expect(second.status).toBe(429);
  });

  it("refuses personal data before calling the model or using the day's attempt", async () => {
    const { call, sent } = setup([good, good]);
    const response = await call({ ...body, situation: body.situation + " Dotazy na jana.novakova@firma.cz." });
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("sensitive_data");
    expect(sent).toHaveLength(0);
    expect((await call()).status).toBe(200);
  });

  it("generates nothing while the author has switched generation off", async () => {
    const claude = { generateCustomTask: async () => good } as unknown as ClaudeClient;
    const response = await handleCustomTask(
      new Request("https://role-lab.test/api/custom-task", { method: "POST", headers: { origin: "https://role-lab.test" }, body: JSON.stringify(body) }),
      { content, claude, limiter: { counter: memoryCounter(), secret: "x" }, issues: null, customTasks: memoryCustomTaskStore({ generationOff: true }) },
    );
    expect(response.status).toBe(503);
    expect((await response.json()).error.code).toBe("custom_tasks_off");
  });

  it("rejects a short description and requests from another page", async () => {
    const { call } = setup([good]);
    expect((await call({ ...body, situation: "Krátce." })).status).toBe(400);
    const foreign = await handleCustomTask(
      new Request("https://role-lab.test/api/custom-task", { method: "POST", headers: { origin: "https://evil.test" }, body: JSON.stringify(body) }),
      { content, claude: {} as ClaudeClient, limiter: { counter: memoryCounter(), secret: "x" }, issues: null, customTasks: memoryCustomTaskStore() },
    );
    expect(foreign.status).toBe(403);
  });
});
