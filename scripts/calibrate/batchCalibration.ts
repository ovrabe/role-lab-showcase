// Evaluator calibration through the Message Batches API (docs/SPEC.md, M3.5): every calibration
// run of every chosen task goes out in one batch at half the price of single calls. Nobody
// waits on calibration, so the batch's delay (usually under an hour) costs nothing.
// Pure functions here; the runner (calibrate.run.ts) does the network and the files.

import { evaluatorModel } from "../../server/claudeClient";
import { parseJsonReply } from "../../server/handlers";
import { costMicroUsd, type Usage } from "../../server/spendBudget";
import { checkOrder, checkStability, checkTraps, type CalibrationCell, type CriterionVerdict } from "../../src/calibration/calibrationCriteria";
import type { CalibrationRun } from "../../src/calibration/calibrationFixtures";
import { computeLevel } from "../../src/evaluation/computeLevel";
import type { EvaluatorKey } from "../../src/evaluation/evaluatorKeySchema";
import { validateEvaluation } from "../../src/evaluation/validateEvaluation";
import { buildEvaluatorPrompt } from "../../src/prompts/evaluator";
import type { DimensionId, RoleConfig } from "../../src/roles/roleSchema";

/** The batch tier costs half of the standard price for every token. */
export const batchDiscount = 0.5;

export type CalibrationJob = { role: RoleConfig; run: CalibrationRun; round: number; key: EvaluatorKey };

// custom_id allows letters, digits, "_" and "-" only, up to 64 characters.
export const customIdOf = (taskId: string, runId: string, round: number) => `${taskId}__${runId}__r${round}`;

export function parseCustomId(customId: string): { taskId: string; runId: string; round: number } | null {
  const match = customId.match(/^(.+)__(.+)__r(\d+)$/);
  return match ? { taskId: match[1], runId: match[2], round: Number(match[3]) } : null;
}

/**
 * One request per run and round, the same as the web's evaluator call (server/claudeClient.ts):
 * model, effort and token ceiling. A batch request cannot stream or use model fallbacks.
 */
export function buildBatchRequests(jobs: CalibrationJob[]) {
  return jobs.map((job) => ({
    custom_id: customIdOf(job.role.id, job.run.id, job.round),
    params: {
      model: evaluatorModel,
      max_tokens: 32000,
      output_config: { effort: "medium" as const },
      messages: [{ role: "user" as const, content: buildEvaluatorPrompt(job.role, job.key, job.run.session) }],
    },
  }));
}

export type CellResult =
  | { customId: string; taskId: string; runId: string; round: number; ok: true; cell: CalibrationCell; costUsd: number; output: unknown }
  | { customId: string; taskId: string; runId: string; round: number; ok: false; problem: string; costUsd: number };

/** Turns one batch result into a calibration cell, with the same checks as the web. */
export function evaluateBatchResult(
  job: CalibrationJob,
  customId: string,
  reply: { text: string; usage: Usage } | { error: string },
): CellResult {
  const base = { customId, taskId: job.role.id, runId: job.run.id, round: job.round };
  if ("error" in reply) return { ...base, ok: false, problem: reply.error, costUsd: 0 };
  const costUsd = (costMicroUsd(evaluatorModel, reply.usage) / 1e6) * batchDiscount;
  const { session } = job.run;
  const result = validateEvaluation(
    parseJsonReply(reply.text),
    job.role,
    job.key.traps,
    session.transcript,
    session.submission,
    session.reflection,
  );
  if (!result.ok) return { ...base, ok: false, problem: result.problems.join(" "), costUsd };
  const output = result.evaluation.output;
  const scores = Object.fromEntries(output.dimensions.map((dimension) => [dimension.id, dimension.score])) as Record<DimensionId, number>;
  const { level, average } = computeLevel(job.role, scores);
  const traps = Object.fromEntries(output.traps.map((trap) => [trap.id, trap.status]));
  // The whole evaluation goes into the report too, so a good one can become a preview sample.
  return { ...base, ok: true, cell: { runId: job.run.id, round: job.round, level, average, traps }, costUsd, output };
}

export type TaskVerdict = { taskId: string; order: CriterionVerdict; traps: CriterionVerdict; stability: CriterionVerdict; failed: number };

/** The three pass criteria per task, from the cells that came back. */
export function verdictsFor(
  tasks: { role: RoleConfig; runs: CalibrationRun[] }[],
  results: CellResult[],
  rounds: number,
): TaskVerdict[] {
  return tasks.map(({ role, runs }) => {
    const mine = results.filter((result) => result.taskId === role.id);
    const cells = mine.flatMap((result) => (result.ok ? [result.cell] : []));
    return {
      taskId: role.id,
      order: checkOrder(runs, cells, rounds),
      traps: checkTraps(runs, cells),
      stability: checkStability(runs, cells),
      failed: mine.filter((result) => !result.ok).length,
    };
  });
}
