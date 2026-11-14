import { z } from "zod";
import { TranscriptItem, TaskSession } from "../src/session/sessionSchema.js";
import type { RoleConfig } from "../src/roles/roleSchema.js";
import { buildAssistantTurns } from "../src/prompts/assistant.js";
import { buildEvaluatorPrompt } from "../src/prompts/evaluator.js";
import { fitTurnsToBudget } from "../src/assistant/promptBudget.js";
import { maxUserMessages } from "../src/assistant/limits.js";
import { validateEvaluation } from "../src/evaluation/validateEvaluation.js";
import type { StoredEvaluation } from "../src/evaluation/evaluationSchema.js";
import type { ServerContent } from "./content.js";
import type { ClaudeClient, ClaudeError } from "./claudeClient.js";
import type { RateLimiter } from "./rateLimit.js";
import { badRequest, json, limitResponse, readJson } from "./http.js";

/**
 * The two endpoints of the web build (docs/SPEC.md, section 13). Web-standard
 * Request -> Response, so the same code runs in a Vercel function, in the Vite dev
 * server and in tests.
 *
 * The browser sends only what the person did: the role, the conversation, the
 * submission. The server checks it, builds the instructions itself (with the same
 * functions as the claude.ai page) and adds the evaluator key, which never leaves
 * the server before the evaluation is done.
 */

// Limits well above any honest use, low enough that the endpoint is useless as free Claude.
const maxTranscriptItems = 300;
const maxItemChars = 20_000;
const maxSubmissionChars = 10_000;
const maxReflectionChars = 5_000;

const Transcript = z.array(TranscriptItem).max(maxTranscriptItems);
const ChatRequest = z.object({ roleId: z.string(), transcript: Transcript });
const EvaluateRequest = z.object({ roleId: z.string(), session: TaskSession });

export type HandlerDeps = { content: ServerContent; claude: ClaudeClient; limiter: RateLimiter };

/** One line of the chat stream (newline-delimited JSON). */
export type ChatStreamEvent =
  | { type: "delta"; text: string }
  | { type: "done"; truncated: boolean }
  | { type: "error"; code: string; message: string };

/** The evaluate response; mirrors EvaluatorOutcome in the page. */
export type EvaluateResponse =
  | { kind: "ok"; evaluation: StoredEvaluation }
  | { kind: "invalid"; problems: string[] }
  | { kind: "error"; code: string; message: string }
  | { kind: "missing_key" };

/** Checks a conversation against the role and the limits; returns a problem or null. */
function transcriptProblem(role: RoleConfig, transcript: TranscriptItem[]): string | null {
  if (transcript.filter((item) => item.kind === "user").length > maxUserMessages) return "Too many messages.";
  if (transcript.some((item) => item.content.length > maxItemChars)) return "A message is too long.";
  const materialIds = new Set(role.materials.map((material) => material.id));
  if (transcript.some((item) => item.event === "data_attached" && !materialIds.has(item.materialId ?? ""))) {
    return "Unknown material.";
  }
  return null;
}

function findRole(content: ServerContent, roleId: string): RoleConfig | undefined {
  return content.roles.activeRoles.find((role) => role.id === roleId);
}

function asClaudeError(error: unknown): ClaudeError {
  if (typeof error === "object" && error !== null && "code" in error) {
    const { code, message, text } = error as Partial<ClaudeError>;
    return { code: String(code), message: String(message ?? ""), ...(text ? { text } : {}) };
  }
  return { code: "upstream_error", message: "Unexpected error." };
}

export async function handleChat(request: Request, { content, claude, limiter }: HandlerDeps): Promise<Response> {
  const body = await readJson(request);
  if (body instanceof Response) return body;
  const parsed = ChatRequest.safeParse(body);
  if (!parsed.success) return badRequest("invalid_request", "Invalid chat request.");
  const role = findRole(content, parsed.data.roleId);
  if (!role) return badRequest("unknown_role", "Unknown role.");
  const problem = transcriptProblem(role, parsed.data.transcript);
  if (problem) return badRequest("invalid_request", problem);

  const fitted = fitTurnsToBudget(buildAssistantTurns(role, parsed.data.transcript, content.getMaterialText));
  if (!fitted) return badRequest("too_large", "Conversation does not fit the prompt budget.", 413);
  if (fitted.turns[fitted.turns.length - 1].role !== "user") return badRequest("invalid_request", "Last turn must be the person's.");
  const limited = await limitResponse(limiter, "chat", request);
  if (limited) return limited;

  // Stream the answer as newline-delimited JSON; errors after the first byte become an event.
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: ChatStreamEvent) => controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      try {
        const result = await claude.chat(fitted.turns, {
          signal: request.signal,
          onDelta: (text) => send({ type: "delta", text }),
        });
        send({ type: "done", truncated: result.truncated });
      } catch (error) {
        const { code, message } = asClaudeError(error);
        send({ type: "error", code, message });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" },
  });
}

export async function handleEvaluate(request: Request, { content, claude, limiter }: HandlerDeps): Promise<Response> {
  const body = await readJson(request);
  if (body instanceof Response) return body;
  const parsed = EvaluateRequest.safeParse(body);
  if (!parsed.success) return badRequest("invalid_request", "Invalid evaluation request.");
  const role = findRole(content, parsed.data.roleId);
  if (!role) return badRequest("unknown_role", "Unknown role.");
  const { session } = parsed.data;
  if (session.roleId !== role.id) return badRequest("invalid_request", "Session belongs to another role.");
  const problem = transcriptProblem(role, session.transcript);
  if (problem) return badRequest("invalid_request", problem);
  if (session.submission.length > maxSubmissionChars || session.reflection.length > maxReflectionChars) {
    return badRequest("too_large", "Submission too long.", 413);
  }
  if (!session.submittedAt) return badRequest("invalid_request", "Only a submitted attempt can be evaluated.");

  const key = content.getEvaluatorKey(role.id);
  if (!key) return json({ kind: "missing_key" } satisfies EvaluateResponse);
  const limited = await limitResponse(limiter, "evaluate", request);
  if (limited) return limited;

  let reply: string;
  try {
    reply = await claude.evaluate(buildEvaluatorPrompt(role, key, session), { signal: request.signal });
  } catch (error) {
    const { code, message } = asClaudeError(error);
    return json({ kind: "error", code, message } satisfies EvaluateResponse);
  }

  const raw = parseJsonReply(reply);
  if (raw === undefined) return json({ kind: "invalid", problems: ["invalid_json"] } satisfies EvaluateResponse);
  const result = validateEvaluation(raw, role, key.traps, session.transcript, session.submission, session.reflection);
  if (!result.ok) return json({ kind: "invalid", problems: result.problems } satisfies EvaluateResponse);

  // Revealed only now, after submission: what each trap was, for the result screen.
  const keyTraps = key.traps.map((trap) => ({
    id: trap.id,
    title: trap.title,
    whatIsWrong: trap.whatIsWrong,
    ...(typeof trap.naiveEffect === "string" ? { naiveEffect: trap.naiveEffect } : {}),
  }));
  return json({ kind: "ok", evaluation: { ...result.evaluation, keyTraps } } satisfies EvaluateResponse);
}

// The model is asked for JSON; tolerate a code fence or a sentence around it.
function parseJsonReply(reply: string): unknown {
  const start = reply.indexOf("{");
  const end = reply.lastIndexOf("}");
  if (start < 0 || end <= start) return undefined;
  try {
    return JSON.parse(reply.slice(start, end + 1));
  } catch {
    return undefined;
  }
}
