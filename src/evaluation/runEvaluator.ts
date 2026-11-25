import type { RoleConfig } from "../roles/roleSchema";
import type { TaskSession } from "../session/sessionSchema";
import type { SampleFunction } from "../runtime/useAiAvailability";
import { buildEvaluatorPrompt } from "../prompts/evaluator";
import { handleSampleError, type SampleErrorHandling } from "../assistant/sampleErrors";
import type { StoredEvaluation } from "./evaluationSchema";
import { getEvaluatorKey } from "./evaluatorKeys";
import { validateEvaluation } from "./validateEvaluation";

export type EvaluatorOutcome =
  | { kind: "ok"; evaluation: StoredEvaluation }
  // The reply came but could not be used (wrong shape, missing dimension).
  // attemptReturned (web): false when the day's attempt was not given back this time.
  | { kind: "invalid"; problems: string[]; attemptReturned?: boolean }
  | { kind: "error"; handling: SampleErrorHandling }
  | { kind: "missing_key" };

/**
 * One evaluator call: prompt, sample.json on the complex tier, validation.
 * Shared by the real evaluation and the calibration panel, so calibration
 * measures exactly what people get.
 */
export async function runEvaluator(
  sample: SampleFunction,
  role: RoleConfig,
  session: TaskSession,
  signal: AbortSignal,
): Promise<EvaluatorOutcome> {
  const key = getEvaluatorKey(role.id);
  if (!key) return { kind: "missing_key" };
  try {
    const raw = await sample.json(buildEvaluatorPrompt(role, key, session), {
      modelTier: "complex",
      cache: false,
      signal,
    });
    const result = validateEvaluation(raw, role, key.traps, session.transcript, session.submission, session.reflection);
    if (!result.ok) {
      console.warn("Evaluator reply rejected:", result.problems, raw);
      return { kind: "invalid", problems: result.problems };
    }
    return { kind: "ok", evaluation: result.evaluation };
  } catch (error) {
    // An unreadable reply is a problem of this one reply, like a reply of the wrong shape,
    // not of the connection: the caller may go on. The message says whether it was cut short.
    if (typeof error === "object" && error !== null && "code" in error && error.code === "invalid_json") {
      const detail = "message" in error ? String(error.message) : "";
      return { kind: "invalid", problems: [`invalid_json: ${detail}`] };
    }
    return { kind: "error", handling: handleSampleError(error) };
  }
}
