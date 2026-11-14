import Anthropic from "@anthropic-ai/sdk";
import type { ChatTurn } from "../src/assistant/promptBudget.js";

/**
 * How the web server talks to Claude. The handlers only see this small interface, so
 * tests and local development without an API key can swap in a fake.
 *
 * Errors are thrown as {code, message, text?} with the same codes the claude.ai runtime
 * uses (see src/assistant/sampleErrors.ts), so the page handles every backend alike.
 */
export type ClaudeClient = {
  // The assistant: streams the answer, calling onDelta with each new piece of text.
  chat(turns: ChatTurn[], options: { signal: AbortSignal; onDelta: (text: string) => void }): Promise<{ truncated: boolean }>;
  // The evaluator: one long answer, returned as text (expected to hold JSON).
  evaluate(prompt: string, options: { signal: AbortSignal }): Promise<string>;
};

export type ClaudeError = { code: string; message: string; text?: string };

// Models chosen in docs/PRODUCTION.md, section 5: the same tiers as in claude.ai
// ("default" for the assistant, "complex" for the evaluator).
export const assistantModel = "claude-sonnet-5-5";
export const evaluatorModel = "claude-opus-5-5";

// A policy decline is retried on a fallback model chosen by the API itself (server-side
// fallback, "default" form), so a rare false refusal does not end the person's turn.
const fallbackBeta = "server-side-fallback-2026-07-01";

function toClaudeError(error: unknown, partialText = ""): ClaudeError {
  if (error instanceof Anthropic.APIUserAbortError) return { code: "cancelled", message: "Aborted.", text: partialText };
  if (error instanceof Anthropic.RateLimitError) return { code: "rate_limited", message: "Rate limited.", text: partialText };
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    // Our key, not the person's fault: a configuration problem on the server.
    return { code: "upstream_error", message: "The server's API key was rejected.", text: partialText };
  }
  if (error instanceof Anthropic.APIError) {
    return { code: "upstream_error", message: `Anthropic API error ${error.status ?? ""}`.trim(), text: partialText };
  }
  return { code: "upstream_error", message: "Unexpected error while calling Claude.", text: partialText };
}

/** The real client. The key comes only from the server's environment (ANTHROPIC_API_KEY). */
export function anthropicClient(apiKey: string): ClaudeClient {
  const client = new Anthropic({ apiKey });

  return {
    async chat(turns, { signal, onDelta }) {
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
        if (message.stop_reason === "refusal") throw { code: "refused", message: "Claude declined.", text } satisfies ClaudeError;
        if (text.trim() === "") throw { code: "empty_completion", message: "Empty answer." } satisfies ClaudeError;
        return { truncated: message.stop_reason === "max_tokens" };
      } catch (error) {
        if (typeof error === "object" && error !== null && "code" in error && !(error instanceof Error)) throw error;
        throw toClaudeError(error, text);
      }
    },

    async evaluate(prompt, { signal }) {
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
        if (message.stop_reason === "refusal") throw { code: "refused", message: "Claude declined." } satisfies ClaudeError;
        return message.content.map((block) => (block.type === "text" ? block.text : "")).join("");
      } catch (error) {
        if (typeof error === "object" && error !== null && "code" in error && !(error instanceof Error)) throw error;
        throw toClaudeError(error);
      }
    },
  };
}
