import { isWebBuild } from "../buildFlags";
import { findChallengeKey } from "./parseChallenges";
import type { ChallengeKey } from "./challengeSchema";

// The claude.ai pages have no server, so they bundle the challenge keys, like the role keys
// (docs/SPEC.md, section 5). The web build leaves them out: its server holds them.
const keyFiles: Record<string, unknown> = isWebBuild
  ? {}
  : import.meta.glob("../../evaluator-data/challenges/*.key.json", { eager: true, import: "default" });

export function getChallengeKey(challengeId: string): ChallengeKey | null {
  return findChallengeKey(keyFiles, challengeId);
}
