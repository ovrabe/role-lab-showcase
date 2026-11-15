import { StoredEvaluation } from "../evaluation/evaluationSchema";
import { ChallengeResult } from "../challenges/challengeResult";
import { handleSampleError } from "../assistant/sampleErrors";
import type { AiBackend } from "./aiBackend";

/**
 * Backend for the web build (docs/SPEC.md, section 13): the page sends the role and what
 * the person did to the project's own server (/api/chat, /api/evaluate), which builds the
 * instructions, adds the evaluator key and calls Claude with the project's API key.
 * Nothing secret is in the page. Errors use the same codes as the claude.ai runtime.
 */

type ErrorBody = { error?: { code?: string; message?: string } };

async function errorFrom(response: Response): Promise<{ code: string; message: string }> {
  const body = (await response.json().catch(() => ({}))) as ErrorBody;
  return { code: body.error?.code ?? "upstream_error", message: body.error?.message ?? `HTTP ${response.status}` };
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export const webBackend: AiBackend = {
  async chat(role, transcript, { signal, onText }) {
    let text = "";
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ roleId: role.id, transcript }),
        signal,
      });
      if (!response.ok || !response.body) throw await errorFrom(response);

      // Newline-delimited JSON events: deltas, then done or error (server/handlers.ts).
      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      let finished: { text: string; truncated: boolean } | undefined;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += value;
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as
            | { type: "delta"; text: string }
            | { type: "done"; truncated: boolean }
            | { type: "error"; code: string; message: string };
          if (event.type === "delta") {
            text += event.text;
            onText(text);
          } else if (event.type === "done") {
            finished = { text, truncated: event.truncated };
          } else {
            throw { code: event.code, message: event.message, text };
          }
        }
      }
      // The server closes the stream right after "done"; reading to the end lets the
      // request finish normally instead of being cut off.
      if (finished) return finished;
      // The stream ended without a final event: the connection broke.
      throw { code: "upstream_error", message: "Stream ended early.", text };
    } catch (error) {
      if (isAbort(error)) throw { code: "cancelled", message: "Aborted.", text };
      if (typeof error === "object" && error !== null && "code" in error) throw { text, ...error };
      throw { code: "upstream_error", message: "Network error.", text };
    }
  },

  async evaluate(role, session, signal) {
    try {
      const response = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ roleId: role.id, session }),
        signal,
      });
      if (!response.ok) return { kind: "error", handling: handleSampleError(await errorFrom(response)) };
      const body = (await response.json()) as
        | { kind: "ok"; evaluation: unknown }
        | { kind: "invalid"; problems: string[] }
        | { kind: "error"; code: string; message: string }
        | { kind: "missing_key" };
      if (body.kind === "ok") {
        // The server checked it already; this guards the shape the page stores.
        const parsed = StoredEvaluation.safeParse(body.evaluation);
        return parsed.success ? { kind: "ok", evaluation: parsed.data } : { kind: "invalid", problems: ["unexpected_shape"] };
      }
      if (body.kind === "error") return { kind: "error", handling: handleSampleError(body) };
      return body;
    } catch (error) {
      if (isAbort(error)) return { kind: "error", handling: handleSampleError({ code: "cancelled" }) };
      return { kind: "error", handling: handleSampleError({ code: "upstream_error" }) };
    }
  },

  async evaluateChallenge(challenge, answer, signal) {
    try {
      const response = await fetch("/api/challenge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ challengeId: challenge.id, answer }),
        signal,
      });
      if (!response.ok) return { kind: "error", handling: handleSampleError(await errorFrom(response)) };
      const body = (await response.json()) as
        | { kind: "ok"; result: unknown }
        | { kind: "invalid"; problems: string[] }
        | { kind: "error"; code: string; message: string }
        | { kind: "missing_key" };
      if (body.kind === "ok") {
        const parsed = ChallengeResult.safeParse(body.result);
        return parsed.success ? { kind: "ok", result: parsed.data } : { kind: "invalid", problems: ["unexpected_shape"] };
      }
      if (body.kind === "error") return { kind: "error", handling: handleSampleError(body) };
      return body;
    } catch (error) {
      if (isAbort(error)) return { kind: "error", handling: handleSampleError({ code: "cancelled" }) };
      return { kind: "error", handling: handleSampleError({ code: "upstream_error" }) };
    }
  },
};
