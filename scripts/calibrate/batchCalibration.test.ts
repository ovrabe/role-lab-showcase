import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadServerContent } from "../../server/content";
import { costMicroUsd } from "../../server/spendBudget";
import type { CalibrationRun } from "../../src/calibration/calibrationFixtures";
import { buildBatchRequests, customIdOf, evaluateBatchResult, parseCustomId, verdictsFor, type CalibrationJob } from "./batchCalibration";

// No network: the batch requests are only built, and a real saved evaluation stands in for
// what the batch returns (fixtures/it-helpdesk-queue.preview-strong.json).
const content = loadServerContent(process.cwd());
const role = content.roles.activeRoles.find((task) => task.id === "it-helpdesk-queue")!;
const key = content.getEvaluatorKey(role.id)!;
const preview = JSON.parse(readFileSync("fixtures/it-helpdesk-queue.preview-strong.json", "utf8"));

const run: CalibrationRun = {
  id: "strong",
  label: "Silný",
  description: "",
  expected: { rank: 3, traps: {} },
  session: {
    version: 1,
    roleId: role.id,
    startedAt: preview.startedAt,
    submittedAt: preview.submittedAt,
    transcript: preview.transcript,
    submission: preview.submission,
    lastSavedSubmission: preview.submission,
    reflection: preview.reflection,
  } as CalibrationRun["session"],
};
const job: CalibrationJob = { role, run, round: 2, key };

describe("batch calibration", () => {
  it("builds one request per run and round, like the web's evaluator call", () => {
    const [request] = buildBatchRequests([job, { ...job, round: 3 }]);
    expect(request.custom_id).toBe("it-helpdesk-queue__strong__r2");
    expect(request.params.model).toBe("claude-opus-5-5");
    expect(request.params.output_config).toEqual({ effort: "medium" });
    expect(request.params.messages[0].content).toContain(key.traps[0].title);
    expect(buildBatchRequests([job, { ...job, round: 3 }])).toHaveLength(2);
  });

  it("keeps custom ids within the API's rules and reads them back", () => {
    for (const task of content.roles.activeRoles) {
      const id = customIdOf(task.id, "medium", 3);
      expect(id).toMatch(/^[a-zA-Z0-9_-]{1,64}$/);
      expect(parseCustomId(id)).toEqual({ taskId: task.id, runId: "medium", round: 3 });
    }
    expect(parseCustomId("nonsense")).toBeNull();
  });

  it("turns a returned evaluation into a cell at half price", () => {
    const usage = { input_tokens: 20_000, output_tokens: 4_000 };
    const result = evaluateBatchResult(job, "x", { text: JSON.stringify(preview.evaluation), usage });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.cell.round).toBe(2);
    expect(result.cell.level).toBeGreaterThanOrEqual(3);
    expect(result.costUsd).toBeGreaterThan(0);
    expect(result.costUsd).toBeCloseTo((costMicroUsd("claude-opus-5-5", usage) / 1e6) * 0.5);
  });

  it("reports an unreadable reply or an API error instead of a cell", () => {
    expect(evaluateBatchResult(job, "x", { text: "no json here", usage: { input_tokens: 1, output_tokens: 1 } }).ok).toBe(false);
    const errored = evaluateBatchResult(job, "x", { error: "expired" });
    expect(errored).toMatchObject({ ok: false, problem: "expired", costUsd: 0 });
  });

  it("counts failed results in the task verdict", () => {
    const failed = evaluateBatchResult(job, "x", { error: "expired" });
    const [verdict] = verdictsFor([{ role, runs: [run] }], [failed], 1);
    expect(verdict.failed).toBe(1);
  });
});
