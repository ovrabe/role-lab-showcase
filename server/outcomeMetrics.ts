import type { RoleConfig } from "../src/roles/roleSchema.js";
import type { TaskSession } from "../src/session/sessionSchema.js";
import type { StoredEvaluation } from "../src/evaluation/evaluationSchema.js";
import { computeLevel } from "../src/evaluation/computeLevel.js";
import { isCustomTask } from "../src/customTask/customTaskRole.js";
import type { MetricEntries } from "./metrics.js";

/**
 * What one evaluation adds to the daily metrics (server/metrics.ts): numbers only, per task.
 * Enough to see which task is too hard or too easy, which trap people miss, which skill is
 * weakest and how long attempts take. Generated custom tasks are counted together as
 * "custom", their random ids would only scatter the numbers.
 */

// Buckets for the length of an attempt (minutes) and the number of the person's messages.
const minuteBuckets = [5, 10, 15, 30, 45, 60] as const;
const messageBuckets = [1, 3, 5, 10, 25] as const;
const bucket = (value: number, limits: readonly number[]) => `le${limits.find((limit) => value <= limit) ?? "max"}`;

export function outcomeMetrics(role: RoleConfig, session: TaskSession, evaluation: StoredEvaluation): MetricEntries {
  const task = isCustomTask(role) ? "custom" : role.id;
  const prefix = `outcome.${task}`;
  const entries: MetricEntries = {};
  const bump = (name: string, amount = 1) => (entries[`${prefix}.${name}`] = (entries[`${prefix}.${name}`] ?? 0) + amount);

  const scores = Object.fromEntries(evaluation.output.dimensions.map((dimension) => [dimension.id, dimension.score]));
  const level = computeLevel(role, scores as Parameters<typeof computeLevel>[1]);
  bump("count");
  bump(`level.${level.level}`);
  if (level.capApplied) bump("level_capped");
  for (const dimension of evaluation.output.dimensions) bump(`score.${dimension.id}`, dimension.score);
  for (const trap of evaluation.output.traps) bump(`trap.${trap.id}.${trap.status}`);
  if (evaluation.codeReviewFlags.length + evaluation.output.humanReviewFlags.length > 0) bump("flagged_for_review");

  const end = session.submittedAt ? Date.parse(session.submittedAt) : Date.now();
  const minutes = Math.max(0, Math.round((end - Date.parse(session.startedAt)) / 60_000));
  const messages = session.transcript.filter((item) => item.kind === "user").length;
  bump("minutes", minutes);
  bump(`minutes.${bucket(minutes, minuteBuckets)}`);
  bump("messages", messages);
  bump(`messages.${bucket(messages, messageBuckets)}`);
  if (session.transcript.some((item) => item.event === "data_attached")) bump("attached_data");
  return entries;
}
