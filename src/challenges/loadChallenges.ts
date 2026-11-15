import { parseChallenges, type LoadedChallenges } from "./parseChallenges";

export type { LoadedChallenges, ChallengeLoadError } from "./parseChallenges";

// Inlined by Vite at build time, like the role configs. Only the public part of each
// challenge matches here; the evaluator's keys live in evaluator-data/challenges/.
const challengeFiles = import.meta.glob("../../data/challenges/*.json", { eager: true, import: "default" });

export function loadChallenges(): LoadedChallenges {
  return parseChallenges(challengeFiles);
}
