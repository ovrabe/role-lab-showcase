import type { RoleConfig } from "../roles/roleSchema";
import type { TaskSession, TranscriptItem } from "../session/sessionSchema";
import type { SampleFunction } from "../runtime/useAiAvailability";
import { buildAssistantTurns } from "../prompts/assistant";
import { getMaterialText } from "../materials/materialFiles";
import { fitTurnsToBudget } from "../assistant/promptBudget";
import { runEvaluator, type EvaluatorOutcome } from "../evaluation/runEvaluator";

export type ChatOptions = {
  signal: AbortSignal;
  // The whole answer so far, every time new text arrives.
  onText: (text: string) => void;
};

/**
 * The one place the app reaches Claude (docs/SPEC.md, section 13). The page hands over
 * the role and what the person did; building the instructions is the backend's job.
 * The claude.ai builds build them here in the page and call claude.use("sample");
 * the web build will send the same data to its own server, which builds them there,
 * so the evaluator's instructions and key never reach the browser.
 *
 * chat() rejects with the same {code, message, text?} errors as sample(), so the
 * existing error handling (assistant/sampleErrors.ts) works for every backend.
 */
export type AiBackend = {
  chat(role: RoleConfig, transcript: TranscriptItem[], options: ChatOptions): Promise<{ text: string; truncated: boolean }>;
  evaluate(role: RoleConfig, session: TaskSession, signal: AbortSignal): Promise<EvaluatorOutcome>;
};

/** Backend for the claude.ai builds: everything in the page, Claude via claude.use("sample"). */
export function claudeAiBackend(sample: SampleFunction): AiBackend {
  return {
    async chat(role, transcript, { signal, onText }) {
      // The panel already checked the size before recording the message; this only
      // drops the oldest turns of a long conversation, as it always has.
      const fitted = fitTurnsToBudget(buildAssistantTurns(role, transcript, getMaterialText));
      if (!fitted) throw { code: "too_large", message: "Conversation does not fit the prompt budget." };
      return sample(fitted.turns, {
        modelTier: "default",
        cache: false,
        signal,
        onText: ({ text }) => onText(text),
      });
    },
    evaluate(role, session, signal) {
      return runEvaluator(sample, role, session, signal);
    },
  };
}
