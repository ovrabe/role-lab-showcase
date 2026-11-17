import { z } from "zod";
import { DimensionId } from "../roles/roleSchema";
import { keepUnreadable, readItem, writeItem } from "../session/sessionStorage";
import type { ChallengeResult } from "./challengeResult";
import type { ChallengeConfig } from "./challengeSchema";

/**
 * Results of short challenges (docs/PRODUCTION.md, part 10, phase 2). A track of its own:
 * challenges never change the skill levels in Můj profil, which come from full tasks only.
 * One short record per evaluated answer, no answer text; the shape can later move into
 * an account (phase 4) unchanged.
 */
export const ChallengeRecord = z.object({
  challengeId: z.string(),
  skill: DimensionId,
  score: z.number().int().min(1).max(4),
  caught: z.number().int().min(0),
  total: z.number().int().min(0),
  completedAt: z.string(),
});
export type ChallengeRecord = z.infer<typeof ChallengeRecord>;

export const ChallengeProgress = z.object({ version: z.literal(1), records: z.array(ChallengeRecord) });
export type ChallengeProgress = z.infer<typeof ChallengeProgress>;

export const emptyChallengeProgress: ChallengeProgress = { version: 1, records: [] };

// Years of daily challenges; the oldest records drop off first.
const maxRecords = 1000;

// Its own key, apart from task progress, so the two tracks never mix.
const storageKey = "role-lab:challenges";

export function recordFromResult(challenge: ChallengeConfig, result: ChallengeResult, completedAt: string): ChallengeRecord {
  return {
    challengeId: challenge.id,
    skill: challenge.skill,
    score: result.score,
    caught: result.traps.filter((trap) => trap.status === "caught").length,
    total: result.traps.length,
    completedAt,
  };
}

export function withRecord(progress: ChallengeProgress, record: ChallengeRecord): ChallengeProgress {
  return { version: 1, records: [...progress.records, record].slice(-maxRecords) };
}

/** The best score each challenge has reached; challenges never tried are missing. */
export function bestScores(records: ChallengeRecord[]): Record<string, number> {
  const best: Record<string, number> = {};
  for (const record of records) best[record.challengeId] = Math.max(best[record.challengeId] ?? 0, record.score);
  return best;
}

export function loadChallengeProgress(): ChallengeProgress {
  const raw = readItem(storageKey);
  if (!raw) return emptyChallengeProgress;
  try {
    const parsed = ChallengeProgress.safeParse(JSON.parse(raw));
    if (parsed.success) return parsed.data;
  } catch {
    // Not JSON: kept below.
  }
  keepUnreadable(storageKey, raw);
  return emptyChallengeProgress;
}

/** Saves one evaluated answer. Returns false when the browser does not allow storage. */
export function recordChallenge(record: ChallengeRecord): boolean {
  return writeItem(storageKey, JSON.stringify(withRecord(loadChallengeProgress(), record)));
}
