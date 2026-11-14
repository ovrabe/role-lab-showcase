import { findEvaluatorKey, type EvaluatorKey } from "./evaluatorKeySchema";
import { isWebBuild } from "../buildFlags";

export type { EvaluatorKey } from "./evaluatorKeySchema";

// The claude.ai pages bundle the keys (docs/SPEC.md, section 5). The web build leaves
// them out: its server holds them and sends the trap explanations after submission.
const keyFiles: Record<string, unknown> = isWebBuild
  ? {}
  : import.meta.glob("../../evaluator-data/*.key.json", { eager: true, import: "default" });

export function getEvaluatorKey(roleId: string): EvaluatorKey | null {
  return findEvaluatorKey(keyFiles, roleId);
}
