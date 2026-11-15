import type { SampleFunction } from "../runtime/useAiAvailability";
import { handleSampleError } from "../assistant/sampleErrors";
import { buildChallengePrompt } from "./challengePrompt";
import { getChallengeKey } from "./challengeKeys";
import { validateChallengeReply, type ChallengeOutcome } from "./challengeResult";
import type { ChallengeConfig } from "./challengeSchema";

/** The claude.ai path: prompt built in the page, sample.json on the quick tier, then validation. */
export async function runChallengeEvaluator(
  sample: SampleFunction,
  challenge: ChallengeConfig,
  answer: string,
  signal: AbortSignal,
): Promise<ChallengeOutcome> {
  const key = getChallengeKey(challenge.id);
  if (!key) return { kind: "missing_key" };
  try {
    const prompt = buildChallengePrompt(challenge, key, answer);
    // One more try when the quick model breaks its own JSON (same as on the web server).
    const ask = () => sample.json(prompt, { modelTier: "quick", cache: false, signal });
    const raw = await ask().catch((error: unknown) => {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "invalid_json") return ask();
      throw error;
    });
    const result = validateChallengeReply(raw, key, answer);
    if (!result.ok) {
      console.warn("Challenge evaluator reply rejected:", result.problems, raw);
      return { kind: "invalid", problems: result.problems };
    }
    return { kind: "ok", result: result.result };
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "invalid_json") {
      return { kind: "invalid", problems: ["invalid_json"] };
    }
    return { kind: "error", handling: handleSampleError(error) };
  }
}
