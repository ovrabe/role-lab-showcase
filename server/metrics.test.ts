import { describe, expect, it } from "vitest";
import { latencyBucket, measureCall, memoryMetrics, pragueDay } from "./metrics";
import { outcomeMetrics } from "./outcomeMetrics";
import { handleEvaluate } from "./handlers";
import { handleCustomTask } from "./customTaskHandler";
import { loadServerContent } from "./content";
import { memoryCounter } from "./rateLimit";
import { memoryCustomTaskStore } from "./customTaskStore";
import { loadPreviewSamples } from "../src/evaluation/previewFixture";
import type { ClaudeClient } from "./claudeClient";

const content = loadServerContent();
const role = content.roles.activeRoles.find((task) => task.id === "category-manager")!;
const strong = loadPreviewSamples(role).find((sample) => sample.id === "strong")!;
const today = () => pragueDay(new Date());
const post = (path: string, body: unknown) =>
  new Request(`http://localhost${path}`, { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json", origin: "http://localhost" } });

describe("metrics", () => {
  it("puts latency into buckets", () => {
    expect(latencyBucket(1500)).toBe("le2");
    expect(latencyBucket(35_000)).toBe("le40");
    expect(latencyBucket(400_000)).toBe("lemax");
  });

  it("records one call: model, tokens, cost, latency and outcome, in one write", async () => {
    const metrics = memoryMetrics();
    const call = measureCall(metrics, "chat");
    call.usage("claude-sonnet-5-5", { input_tokens: 1000, output_tokens: 200 });
    await call.finish("ok");
    const day = await metrics.readDay(today());
    expect(day["model.chat.claude-sonnet-5-5.calls"]).toBe(1);
    expect(day["model.chat.claude-sonnet-5-5.input_tokens"]).toBe(1000);
    expect(day["spend.chat.claude-sonnet-5-5"]).toBe(4000);
    expect(day["call.chat.ok"]).toBe(1);
    expect(day["latency.chat.le2"]).toBe(1);
  });

  it("counts an error by its code", async () => {
    const metrics = memoryMetrics();
    await measureCall(metrics, "evaluate").finish("overloaded");
    const day = await metrics.readDay(today());
    expect(day).toMatchObject({ "call.evaluate.error": 1, "error.evaluate.overloaded": 1 });
  });

  it("summarises an evaluation as numbers only", () => {
    const entries = outcomeMetrics(role, strong.session, strong.session.evaluation!);
    expect(entries["outcome.category-manager.count"]).toBe(1);
    expect(Object.keys(entries).some((name) => name.startsWith("outcome.category-manager.level."))).toBe(true);
    expect(Object.keys(entries).some((name) => /^outcome\.category-manager\.trap\.T1_.+\.(caught|partial|missed)$/.test(name))).toBe(true);
    // Nothing the person wrote ends up in a metric.
    expect(JSON.stringify(entries)).not.toContain(strong.session.submission.slice(0, 30));
    expect(Object.values(entries).every((value) => typeof value === "number")).toBe(true);
  });

  it("is written by a real evaluation, with the outcome and the model call", async () => {
    const metrics = memoryMetrics();
    const claude = {
      async evaluate(_prompt: string, options: { onUsage?: (model: string, usage: { input_tokens: number; output_tokens: number }) => Promise<void> }) {
        await options.onUsage?.("claude-opus-5-5", { input_tokens: 20_000, output_tokens: 3_000 });
        return JSON.stringify(strong.session.evaluation!.output);
      },
    } as unknown as ClaudeClient;
    const deps = { content, claude, limiter: { counter: memoryCounter(), secret: "t", metrics } };
    const response = await handleEvaluate(post("/api/evaluate", { roleId: role.id, session: strong.session }), deps);
    expect(((await response.json()) as { kind: string }).kind).toBe("ok");
    const day = await metrics.readDay(today());
    expect(day["outcome.category-manager.count"]).toBe(1);
    expect(day["model.evaluate.claude-opus-5-5.output_tokens"]).toBe(3000);
    expect(day["call.evaluate.ok"]).toBe(1);
  });

  it("counts a description refused for personal data, without its text", async () => {
    const metrics = memoryMetrics();
    const deps = {
      content,
      claude: { generateCustomTask: async () => "" } as unknown as ClaudeClient,
      limiter: { counter: memoryCounter(), secret: "t", metrics },
      issues: null,
      customTasks: memoryCustomTaskStore(),
    };
    const body = { role: "Nákupčí", situation: "Objednávám léky pro čtyřicet lékáren, dotazy na jana.novakova@firma.cz.", deliverable: "", data: null };
    expect((await handleCustomTask(post("/api/custom-task", body), deps)).status).toBe(400);
    const day = await metrics.readDay(today());
    expect(day).toEqual({ "security.sensitive_data_blocked": 1 });
  });
});
