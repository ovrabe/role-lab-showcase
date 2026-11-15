import { dimensionIds } from "../roles/roleSchema.js";
import { ChallengeConfig, ChallengeKey } from "./challengeSchema.js";

export type ChallengeLoadError = { file: string; problems: string[] };

export type LoadedChallenges = {
  // Sorted the way the challenge map shows them: by skill (rubric order), then by order.
  challenges: ChallengeConfig[];
  errors: ChallengeLoadError[];
};

const fileName = (path: string) => path.replace(/^.*\//, "");

function describeIssues(issues: { path: PropertyKey[]; message: string }[]): string[] {
  return issues.map((issue) => `${issue.path.map(String).join(".") || "(celý soubor)"}: ${issue.message}`);
}

/** Validates the public challenge files. No file access here: the page and the server pass them in. */
export function parseChallenges(challengeFiles: Record<string, unknown>): LoadedChallenges {
  const challenges: ChallengeConfig[] = [];
  const errors: ChallengeLoadError[] = [];

  for (const [path, content] of Object.entries(challengeFiles)) {
    const file = `data/challenges/${fileName(path)}`;
    const result = ChallengeConfig.safeParse(content);
    if (!result.success) {
      errors.push({ file, problems: describeIssues(result.error.issues) });
    } else if (fileName(path) !== `${result.data.id}.json`) {
      // One name for the file and the id, so the key file is easy to find.
      errors.push({ file, problems: [`id: soubor se musí jmenovat ${result.data.id}.json`] });
    } else {
      challenges.push(result.data);
    }
  }

  const seen = new Set<string>();
  for (const challenge of challenges) {
    const place = `${challenge.skill} ${challenge.order}`;
    if (seen.has(place)) errors.push({ file: `data/challenges/${challenge.id}.json`, problems: [`order: pořadí ${place} už má jiná výzva`] });
    seen.add(place);
  }

  challenges.sort((a, b) => dimensionIds.indexOf(a.skill) - dimensionIds.indexOf(b.skill) || a.order - b.order);
  return { challenges, errors };
}

/** Finds and validates the evaluator's key of one challenge among loaded key files. */
export function findChallengeKey(keyFiles: Record<string, unknown>, challengeId: string): ChallengeKey | null {
  for (const content of Object.values(keyFiles)) {
    const result = ChallengeKey.safeParse(content);
    if (result.success && result.data.challengeId === challengeId) return result.data;
  }
  return null;
}
