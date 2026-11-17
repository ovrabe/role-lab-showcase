import { z } from "zod";
import { TranscriptItem, TaskSession } from "../src/session/sessionSchema.js";
import type { RoleConfig } from "../src/roles/roleSchema.js";
import { buildAssistantTurns } from "../src/prompts/assistant.js";
import { buildEvaluatorPrompt } from "../src/prompts/evaluator.js";
import { fitTurnsToBudget } from "../src/assistant/promptBudget.js";
import { maxMessageChars, maxUserMessages } from "../src/assistant/limits.js";
import { validateEvaluation } from "../src/evaluation/validateEvaluation.js";
import type { StoredEvaluation } from "../src/evaluation/evaluationSchema.js";
import type { ServerContent } from "./content.js";
import type { ClaudeClient, ClaudeError } from "./claudeClient.js";
import type { RateLimiter } from "./rateLimit.js";
import { badRequest, json, limitResponse, readJson } from "./http.js";
import { handleClaudeFailure } from "./claudeFailure.js";
import { budgetResponse, recordSpend } from "./spendBudget.js";
import type { IssueTracker } from "./issues.js";

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
// Messages are capped on their own (maxUserMessages, maxMessageChars); the rest of the record
// is short events that pile up in honest use (every save of the submission, every download),
// so the item cap is generous: 300 could be reached by switching tabs on a phone.
const maxTranscriptItems = 2_000;
const maxSubmissionChars = 10_000;
const maxReflectionChars = 5_000;

const Transcript = z.array(TranscriptItem).max(maxTranscriptItems);
const ChatRequest = z.object({ roleId: z.string(), transcript: Transcript });
const EvaluateRequest = z.object({ roleId: z.string(), session: TaskSession });

// issues: where an outage alert goes (server/claudeFailure.ts); optional, like in deps.ts.
export type HandlerDeps = { content: ServerContent; claude: ClaudeClient; limiter: RateLimiter; issues?: IssueTracker | null };

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

// The page writes times as new Date().toISOString(). Anything else was typed by hand, and a
// time goes into the evaluator's prompt as it is: it must not be able to carry text.
const isoTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;
export const isTimestamp = (value: string) => isoTime.test(value) && !Number.isNaN(Date.parse(value));

/** Checks a conversation against the role and the limits; returns a problem or null. */
function transcriptProblem(role: RoleConfig, transcript: TranscriptItem[]): string | null {
  if (transcript.filter((item) => item.kind === "user").length > maxUserMessages) return "Too many messages.";
  if (transcript.some((item) => !isTimestamp(item.ts))) return "Invalid time in the conversation.";
  // Only the person's messages: the assistant's answers can be longer (16 000 tokens), and
  // refusing a long answer already in the record would block the rest of the attempt.
  if (transcript.some((item) => item.kind === "user" && item.content.length > maxMessageChars)) return "A message is too long.";
  const materialIds = new Set(role.materials.map((material) => material.id));
  if (transcript.some((item) => item.event === "data_attached" && !materialIds.has(item.materialId ?? ""))) {
    return "Unknown material.";
  }
  return null;
}

function findRole(content: ServerContent, roleId: string): RoleConfig | undefined {
  return content.roles.activeRoles.find((role) => role.id === roleId);
}

export function asClaudeError(error: unknown): ClaudeError {
  if (typeof error === "object" && error !== null && "code" in error) {
    const { code, message, text } = error as Partial<ClaudeError>;
    return { code: String(code), message: String(message ?? ""), ...(text ? { text } : {}) };
  }
  return { code: "upstream_error", message: "Unexpected error." };
}

export async function handleChat(request: Request, { content, claude, limiter, issues }: HandlerDeps): Promise<Response> {
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
  const overBudget = await budgetResponse(limiter, request, issues);
  if (overBudget) return overBudget;
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
          onUsage: (model, usage) => recordSpend(limiter, request, model, usage),
        });
        send({ type: "done", truncated: result.truncated });
      } catch (error) {
        const failure = asClaudeError(error);
        await handleClaudeFailure({ limiter, issues }, "chat", request, failure);
        send({ type: "error", code: failure.code, message: failure.message });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" },
  });
}

export async function handleEvaluate(request: Request, { content, claude, limiter, issues }: HandlerDeps): Promise<Response> {
  // A whole attempt can be long (25 messages, long answers). The prompt is cut to its budget
  // anyway (src/prompts/evaluator.ts), so the body may be bigger than a chat call; Vercel takes 4.5 MB.
  const body = await readJson(request, 4_000_000);
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
  if (!isTimestamp(session.startedAt) || !isTimestamp(session.submittedAt)) return badRequest("invalid_request", "Invalid time of the attempt.");

  const key = content.getEvaluatorKey(role.id);
  if (!key) return json({ kind: "missing_key" } satisfies EvaluateResponse);
  const overBudget = await budgetResponse(limiter, request, issues);
  if (overBudget) return overBudget;
  const limited = await limitResponse(limiter, "evaluate", request);
  if (limited) return limited;

  let reply: string;
  try {
    reply = await claude.evaluate(buildEvaluatorPrompt(role, key, session), {
      signal: request.signal,
      onUsage: (model, usage) => recordSpend(limiter, request, model, usage),
    });
  } catch (error) {
    const failure = asClaudeError(error);
    await handleClaudeFailure({ limiter, issues }, "evaluate", request, failure);
    return json({ kind: "error", code: failure.code, message: failure.message } satisfies EvaluateResponse);
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
export function parseJsonReply(reply: string): unknown {
  const start = reply.indexOf("{");
  const end = reply.lastIndexOf("}");
  if (start < 0 || end <= start) return undefined;
  try {
    return JSON.parse(reply.slice(start, end + 1));
  } catch {
    return undefined;
  }
}
