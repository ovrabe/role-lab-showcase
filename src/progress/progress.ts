import { z } from "zod";
import { DimensionId, dimensionIds, type RoleConfig } from "../roles/roleSchema";
import type { StoredEvaluation } from "../evaluation/evaluationSchema";
import { computeLevel } from "../evaluation/computeLevel";

/**
 * Progress across attempts (docs/PRODUCTION.md, part 10, phase 1). One short record per
 * finished evaluation: no conversation, no submission, only what progress needs. The
 * shape is meant to move unchanged into a database once accounts exist (phase 4).
 */
export const ProgressAttempt = z.object({
  roleId: z.string(),
  evaluatedAt: z.string(),
  level: z.number().int().min(1).max(4),
  scores: z.record(DimensionId, z.number().int().min(1).max(4)),
  traps: z.object({ caught: z.number().int().min(0), total: z.number().int().min(0) }),
});
export type ProgressAttempt = z.infer<typeof ProgressAttempt>;

export const Progress = z.object({ version: z.literal(1), attempts: z.array(ProgressAttempt) });
export type Progress = z.infer<typeof Progress>;

export const emptyProgress: Progress = { version: 1, attempts: [] };

// Plenty for years of daily practice; the oldest records drop off first.
const maxAttempts = 500;

export type SkillLevels = Partial<Record<DimensionId, number>>;
export type SkillChange = { dimension: DimensionId; from: number; to: number };

export function attemptFromEvaluation(role: RoleConfig, evaluation: StoredEvaluation): ProgressAttempt {
  const scores = Object.fromEntries(evaluation.output.dimensions.map((dimension) => [dimension.id, dimension.score])) as Record<
    DimensionId,
    number
  >;
  return {
    roleId: role.id,
    evaluatedAt: evaluation.evaluatedAt,
    level: computeLevel(role, scores).level,
    scores,
    traps: {
      caught: evaluation.output.traps.filter((trap) => trap.status === "caught").length,
      total: evaluation.output.traps.length,
    },
  };
}

/** Adds an attempt, oldest first. The same evaluation recorded twice stays once. */
export function withAttempt(progress: Progress, attempt: ProgressAttempt): Progress {
  const exists = progress.attempts.some((item) => item.roleId === attempt.roleId && item.evaluatedAt === attempt.evaluatedAt);
  if (exists) return progress;
  return { version: 1, attempts: [...progress.attempts, attempt].slice(-maxAttempts) };
}

/** Where the person is now: each skill's score from the latest attempt, across roles. */
export function skillLevels(attempts: ProgressAttempt[]): SkillLevels {
  const levels: SkillLevels = {};
  for (const attempt of attempts) Object.assign(levels, attempt.scores);
  return levels;
}

/** The attempt that belongs to an evaluation, or -1 (samples, evaluations from before progress existed). */
export function attemptIndex(attempts: ProgressAttempt[], roleId: string, evaluatedAt: string): number {
  return attempts.findIndex((attempt) => attempt.roleId === roleId && attempt.evaluatedAt === evaluatedAt);
}

/** What one attempt changed, compared with the skill levels from all attempts before it. */
export function changesAt(attempts: ProgressAttempt[], index: number): SkillChange[] {
  if (index < 1 || index >= attempts.length) return [];
  const before = skillLevels(attempts.slice(0, index));
  const current = attempts[index];
  return dimensionIds.flatMap((dimension) => {
    const from = before[dimension];
    const to = current.scores[dimension];
    return from !== undefined && to !== undefined && from !== to ? [{ dimension, from, to }] : [];
  });
}

/** The weakest skill; on a tie the earlier one in the rubric, since it comes first in the work. */
export function recommendedSkill(levels: SkillLevels): DimensionId | null {
  let weakest: DimensionId | null = null;
  for (const dimension of dimensionIds) {
    const level = levels[dimension];
    if (level === undefined) continue;
    if (weakest === null || level < (levels[weakest] ?? Infinity)) weakest = dimension;
  }
  return weakest;
}
