import Anthropic from "@anthropic-ai/sdk";
import type { ChatTurn } from "../src/assistant/promptBudget.js";
import type { Usage } from "./spendBudget.js";

/**
 * How the web server talks to Claude. The handlers only see this small interface, so
 * tests and local development without an API key can swap in a fake.
 *
 * Errors are thrown as {code, message, text?} with the same codes the claude.ai runtime
 * uses (see src/assistant/sampleErrors.ts), so the page handles every backend alike.
 */
// onUsage: told what a finished call used, so the server can count the day's spending.
type CallOptions = { signal: AbortSignal; onUsage?: (model: string, usage: Usage) => Promise<void> };

export type ClaudeClient = {
  // The assistant: streams the answer, calling onDelta with each new piece of text.
  chat(turns: ChatTurn[], options: CallOptions & { onDelta: (text: string) => void }): Promise<{ truncated: boolean }>;
  // The evaluator: one long answer, returned as text (expected to hold JSON).
  evaluate(prompt: string, options: CallOptions): Promise<string>;
  // The short-challenge evaluator: a short JSON answer from the cheaper model.
  evaluateChallenge(prompt: string, options: CallOptions): Promise<string>;
};

export type ClaudeError = { code: string; message: string; text?: string };

// Models chosen in docs/PRODUCTION.md, section 5: the same tiers as in claude.ai
// ("default" for the assistant, "complex" for the evaluator).
export const assistantModel = "claude-sonnet-5-5";
export const evaluatorModel = "claude-opus-5-5";
// Short challenges (docs/PRODUCTION.md, part 10): one answer of a few sentences against a
// short key. A small, fast model is enough and costs a fraction of a crown per evaluation.
export const challengeModel = "claude-haiku-5-5";

// A policy decline is retried on a fallback model chosen by the API itself (server-side
// fallback, "default" form), so a rare false refusal does not end the person's turn.
const fallbackBeta = "server-side-fallback-2026-07-01";

export function toClaudeError(error: unknown, partialText = ""): ClaudeError {
  if (error instanceof Anthropic.APIUserAbortError) return { code: "cancelled", message: "Aborted.", text: partialText };
  if (error instanceof Anthropic.RateLimitError) return { code: "rate_limited", message: "Rate limited.", text: partialText };
  // Our account, not the person's fault: the key was rejected or expired, or the prepaid
  // credit ran out (a 400 that says so). Retrying cannot help until the author steps in.
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    return { code: "ai_unavailable", message: "The server's API key was rejected.", text: partialText };
  }
  if (error instanceof Anthropic.BadRequestError && /credit balance/i.test(error.message)) {
    return { code: "ai_unavailable", message: "Anthropic credit balance too low.", text: partialText };
  }
  if (error instanceof Anthropic.APIError) {
    return { code: "upstream_error", message: `Anthropic API error ${error.status ?? ""}`.trim(), text: partialText };
  }
  return { code: "upstream_error", message: "Unexpected error while calling Claude.", text: partialText };
}

/** The real client. The key comes only from the server's environment (ANTHROPIC_API_KEY). */
export function anthropicClient(apiKey: string): ClaudeClient {
  // Vercel ends a function after 300 s (vercel.json). Giving up a little earlier returns a
  // clean error to the page instead of a cut connection. One retry is enough for a brief
  // overload; the SDK's default two retries could keep a person waiting for minutes.
  const client = new Anthropic({ apiKey, timeout: 280_000, maxRetries: 1 });

  return {
    async chat(turns, { signal, onDelta, onUsage }) {
      let text = "";
      try {
        const stream = client.beta.messages.stream(
          {
            model: assistantModel,
            max_tokens: 16000,
            betas: [fallbackBeta],
            fallbacks: "default",
            // Chat answers: thorough enough for calculations, without long pauses.
            output_config: { effort: "medium" },
            // Every turn resends the whole conversation, attached materials included. With the
            // cache, the part already sent costs a tenth on the next turn (for 5 minutes).
            cache_control: { type: "ephemeral" },
            messages: turns,
          },
          { signal },
        );
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            text += event.delta.text;
            onDelta(event.delta.text);
          }
        }
        const message = await stream.finalMessage();
        // Token counts only, never content: shows in the Vercel log whether the cache works.
        const { input_tokens, cache_read_input_tokens, cache_creation_input_tokens, output_tokens } = message.usage;
        console.log(`Chat usage: input ${input_tokens}, cache read ${cache_read_input_tokens ?? 0}, cache write ${cache_creation_input_tokens ?? 0}, output ${output_tokens}`);
        await onUsage?.(assistantModel, message.usage);
        if (message.stop_reason === "refusal") throw { code: "refused", message: "Claude declined.", text } satisfies ClaudeError;
        if (text.trim() === "") throw { code: "empty_completion", message: "Empty answer." } satisfies ClaudeError;
        return { truncated: message.stop_reason === "max_tokens" };
      } catch (error) {
        if (typeof error === "object" && error !== null && "code" in error && !(error instanceof Error)) throw error;
        throw toClaudeError(error, text);
      }
    },

    async evaluate(prompt, { signal, onUsage }) {
      try {
        // Streamed even though nobody watches: the evaluation can take minutes, and a
        // long non-streaming request risks an HTTP timeout.
        const stream = client.beta.messages.stream(
          {
            model: evaluatorModel,
            max_tokens: 32000,
            betas: [fallbackBeta],
            fallbacks: "default",
            output_config: { effort: "high" },
            messages: [{ role: "user", content: prompt }],
          },
          { signal },
        );
        const message = await stream.finalMessage();
        await onUsage?.(evaluatorModel, message.usage);
        if (message.stop_reason === "refusal") throw { code: "refused", message: "Claude declined." } satisfies ClaudeError;
        return message.content.map((block) => (block.type === "text" ? block.text : "")).join("");
      } catch (error) {
        if (typeof error === "object" && error !== null && "code" in error && !(error instanceof Error)) throw error;
        throw toClaudeError(error);
      }
    },

    async evaluateChallenge(prompt, { signal, onUsage }) {
      try {
        const message = await client.messages.create(
          // The model thinks before it answers and the thinking counts toward max_tokens
          // (about 1,000 tokens in calibration). 2,000 cut the longer replies short; the
          // price is per token used, so a generous ceiling costs nothing extra.
          { model: challengeModel, max_tokens: 8000, messages: [{ role: "user", content: prompt }] },
          { signal },
        );
        await onUsage?.(challengeModel, message.usage);
        if (message.stop_reason === "refusal") throw { code: "refused", message: "Claude declined." } satisfies ClaudeError;
        return message.content.map((block) => (block.type === "text" ? block.text : "")).join("");
      } catch (error) {
        if (typeof error === "object" && error !== null && "code" in error && !(error instanceof Error)) throw error;
        throw toClaudeError(error);
      }
    },
  };
}
