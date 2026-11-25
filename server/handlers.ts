import { measureCall } from "./metrics.js";
import { outcomeMetrics } from "./outcomeMetrics.js";
import { z } from "zod";
import { TranscriptItem, TaskSession } from "../src/session/sessionSchema.js";
import type { RoleConfig } from "../src/roles/roleSchema.js";
import { buildAssistantTurns } from "../src/prompts/assistant.js";
import { buildEvaluatorPrompt } from "../src/prompts/evaluator.js";
import { fitTurnsToBudget } from "../src/assistant/promptBudget.js";
import { maxAssistantChars, maxEventChars, maxMessageChars, maxUserMessages } from "../src/assistant/limits.js";
import { maxPromptBytes } from "../src/assistant/promptBudget.js";
import { validateEvaluation } from "../src/evaluation/validateEvaluation.js";
import type { StoredEvaluation } from "../src/evaluation/evaluationSchema.js";
import type { ServerContent } from "./content.js";
import { assistantModel, callDeadline, evaluatorModel, maxOutputTokens, minTimeForRetryMs, type CallDeadline, type ClaudeClient, type ClaudeError } from "./claudeClient.js";
import type { RateLimiter } from "./rateLimit.js";
import { badRequest, json, limitReachedResponse, limitResponse, readJson } from "./http.js";
import { handleClaudeFailure } from "./claudeFailure.js";
import { cutOffEstimator, reserveBudget, settleAfter, worstCaseMicroUsd, type BudgetReservation } from "./spendBudget.js";
import { giveBackToLimit } from "./rateLimit.js";
import type { IssueTracker } from "./issues.js";
import type { CustomTaskStore } from "./customTaskStore.js";
import type { EvaluatorKey } from "../src/evaluation/evaluatorKeySchema.js";
import type { MaterialTextLookup } from "../src/roles/parseRoles.js";
import { composeCustomTask, customEvaluatorKey, customMaterialTexts, customTaskIdOf } from "../src/customTask/customTaskRole.js";
import { publicPart } from "../src/customTask/generatedTask.js";
import { isCustomTask } from "../src/customTask/customTaskRole.js";
import { countCustomTask } from "./statsHandler.js";
import { exampleTokenFor } from "./exampleHandler.js";

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
export const maxSubmissionChars = 10_000;
const maxReflectionChars = 5_000;

const Transcript = z.array(TranscriptItem).max(maxTranscriptItems);
const ChatRequest = z.object({ roleId: z.string(), transcript: Transcript });
const EvaluateRequest = z.object({ roleId: z.string(), session: TaskSession });

// issues: where an outage alert goes (server/claudeFailure.ts); optional, like in deps.ts.
// customTasks: generated custom tasks (server/customTaskStore.ts); without it only the fixed tasks work.
export type HandlerDeps = {
  content: ServerContent;
  claude: ClaudeClient;
  limiter: RateLimiter;
  issues?: IssueTracker | null;
  customTasks?: CustomTaskStore;
};

/** One line of the chat stream (newline-delimited JSON). */
export type ChatStreamEvent =
  | { type: "delta"; text: string }
  | { type: "done"; truncated: boolean }
  | { type: "error"; code: string; message: string };

/** The evaluate response; mirrors EvaluatorOutcome in the page. */
export type EvaluateResponse =
  | { kind: "ok"; evaluation: StoredEvaluation }
  // attemptReturned: whether the day's attempt came back (the page says so truthfully).
  | { kind: "invalid"; problems: string[]; attemptReturned: boolean }
  | { kind: "error"; code: string; message: string }
  | { kind: "missing_key" };

// The page writes times as new Date().toISOString(). Anything else was typed by hand, and a
// time goes into the evaluator's prompt as it is: it must not be able to carry text.
const isoTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;
export const isTimestamp = (value: string) => isoTime.test(value) && !Number.isNaN(Date.parse(value));

/** Checks a conversation against the role and the limits; returns a problem or null. */
export function transcriptProblem(role: RoleConfig, transcript: TranscriptItem[]): string | null {
  if (transcript.filter((item) => item.kind === "user").length > maxUserMessages) return "Too many messages.";
  if (transcript.some((item) => !isTimestamp(item.ts))) return "Invalid time in the conversation.";
  // Only the person's messages: the assistant's answers can be longer (16 000 tokens), and
  // refusing a long answer already in the record would block the rest of the attempt.
  if (transcript.some((item) => item.kind === "user" && item.content.length > maxMessageChars)) return "A message is too long.";
  if (transcript.some((item) => item.kind === "assistant" && item.content.length > maxAssistantChars)) return "An answer in the conversation is too long.";
  // The app writes events itself, each with its name and a short note. Without this check an event
  // could carry megabytes of text past every cap straight into the evaluator's prompt.
  if (transcript.some((item) => item.kind === "event" && (!item.event || item.content.length > maxEventChars))) return "Invalid event in the conversation.";
  const materialIds = new Set(role.materials.map((material) => material.id));
  if (transcript.some((item) => item.event === "data_attached" && !materialIds.has(item.materialId ?? ""))) {
    return "Unknown material.";
  }
  return null;
}

/** A task the server can run: its config, its material texts and (server only) its evaluator key. */
type ResolvedTask = { role: RoleConfig; getMaterialText: MaterialTextLookup; getKey: () => EvaluatorKey | null };

/**
 * Finds the task by the id the page sends. A fixed task comes from data/; a generated one
 * ("custom-<id>") is loaded from the store, so the page can never send its own task or key.
 */
export async function resolveTask({ content, customTasks }: HandlerDeps, roleId: string): Promise<ResolvedTask | null> {
  const fixed = content.roles.activeRoles.find((role) => role.id === roleId);
  if (fixed) return { role: fixed, getMaterialText: content.getMaterialText, getKey: () => content.getEvaluatorKey(fixed.id) };
  const customTaskId = customTaskIdOf(roleId);
  if (!customTaskId || !customTasks || !/^[A-Za-z0-9_-]{12}$/.test(customTaskId)) return null;
  const stored = await customTasks.load(customTaskId);
  if (!stored) return null;
  const texts = customMaterialTexts(customTaskId, publicPart(stored.task));
  return {
    role: composeCustomTask(content.customRole, customTaskId, publicPart(stored.task)),
    getMaterialText: (file) => texts.get(file),
    getKey: () => customEvaluatorKey(customTaskId, stored.task),
  };
}

/**
 * Whether a second try of a call may start: enough time left before the deadline, and the
 * budget holds its worst case too (every call a request makes is covered by a hold).
 */
export async function mayTryAgain(deadline: CallDeadline, budget: BudgetReservation): Promise<boolean> {
  return deadline.timeLeftMs() >= minTimeForRetryMs && (await budget.holdAnother());
}

export function asClaudeError(error: unknown, deadline?: CallDeadline): ClaudeError {
  // Its own code: the call ran and was billed, so the attempt is not given back as after an
  // outage, and Slack gets no "model failing" alarm. The page offers to try again.
  if (deadline?.timedOut()) return { code: "timeout", message: "The call took too long." };
  if (typeof error === "object" && error !== null && "code" in error) {
    const { code, message, text, reason } = error as Partial<ClaudeError>;
    return { code: String(code), message: String(message ?? ""), ...(text ? { text } : {}), ...(reason ? { reason } : {}) };
  }
  return { code: "upstream_error", message: "Unexpected error." };
}

export async function handleChat(request: Request, deps: HandlerDeps): Promise<Response> {
  const { claude, limiter, issues } = deps;
  const body = await readJson(request);
  if (body instanceof Response) return body;
  const parsed = ChatRequest.safeParse(body);
  if (!parsed.success) return badRequest("invalid_request", "Invalid chat request.");
  const task = await resolveTask(deps, parsed.data.roleId);
  if (!task) return badRequest("unknown_role", "Unknown role.");
  const { role } = task;
  const problem = transcriptProblem(role, parsed.data.transcript);
  if (problem) return badRequest("invalid_request", problem);

  const fitted = fitTurnsToBudget(buildAssistantTurns(role, parsed.data.transcript, task.getMaterialText));
  if (!fitted) return badRequest("too_large", "Conversation does not fit the prompt budget.", 413);
  if (fitted.turns[fitted.turns.length - 1].role !== "user") return badRequest("invalid_request", "Last turn must be the person's.");
  const promptChars = JSON.stringify(fitted.turns).length;
  const deadline = callDeadline(request);
  // The page can stop reading the answer (a closed tab) before the request itself is aborted.
  const pageGone = new AbortController();
  const callSignal = AbortSignal.any([deadline.signal, pageGone.signal]);
  const full = await limitReachedResponse(limiter, "chat", request);
  if (full) return full;
  const budget = await reserveBudget(limiter, request, issues, worstCaseMicroUsd(assistantModel, promptChars, maxOutputTokens.chat), callSignal);
  if (budget instanceof Response) return budget;
  const limited = await limitResponse(limiter, "chat", request);
  if (limited) return (await budget.settle(), limited);

  // Stream the answer as newline-delimited JSON; errors after the first byte become an event.
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // Writing to a stream the page no longer reads throws; that ends the call as cancelled,
      // not as a failing model (which used to post a false alarm to Slack).
      const send = (event: ChatStreamEvent) => {
        if (pageGone.signal.aborted) return;
        try {
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        } catch {
          pageGone.abort();
        }
      };
      const call = measureCall(limiter.metrics, "chat");
      let answerChars = 0;
      try {
        const result = await claude.chat(fitted.turns, {
          signal: callSignal,
          onDelta: (text) => ((answerChars += text.length), send({ type: "delta", text })),
          onUsage: (model, usage) => (call.usage(model, usage), budget.record(model, usage)),
        });
        send({ type: "done", truncated: result.truncated });
        await call.finish(result.truncated ? "truncated" : "ok");
      } catch (error) {
        const failure = pageGone.signal.aborted ? { code: "cancelled", message: "The page stopped reading." } : asClaudeError(error, deadline);
        await handleClaudeFailure({ limiter, issues }, "chat", request, failure);
        send({ type: "error", code: failure.code, message: failure.message });
        await call.finish(failure.code);
      } finally {
        // Cut off mid-answer: the prompt and what was already written were billed.
        await budget.settle(worstCaseMicroUsd(assistantModel, promptChars, Math.ceil(answerChars / 2)));
        if (!pageGone.signal.aborted) controller.close();
      }
    },
    cancel() {
      pageGone.abort();
    },
  });
  return new Response(stream, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" },
  });
}

export async function handleEvaluate(request: Request, deps: HandlerDeps): Promise<Response> {
  const { limiter, issues } = deps;
  // A whole attempt can be long (25 messages, long answers). The prompt is cut to its budget
  // anyway (src/prompts/evaluator.ts), so the body may be bigger than a chat call; Vercel takes 4.5 MB.
  const body = await readJson(request, 4_000_000);
  if (body instanceof Response) return body;
  const parsed = EvaluateRequest.safeParse(body);
  if (!parsed.success) return badRequest("invalid_request", "Invalid evaluation request.");
  const task = await resolveTask(deps, parsed.data.roleId);
  if (!task) return badRequest("unknown_role", "Unknown role.");
  const { role } = task;
  const { session } = parsed.data;
  if (session.roleId !== role.id) return badRequest("invalid_request", "Session belongs to another role.");
  const problem = transcriptProblem(role, session.transcript);
  if (problem) return badRequest("invalid_request", problem);
  if (session.submission.length > maxSubmissionChars || session.reflection.length > maxReflectionChars) {
    return badRequest("too_large", "Submission too long.", 413);
  }
  if (!session.submittedAt) return badRequest("invalid_request", "Only a submitted attempt can be evaluated.");
  if (!isTimestamp(session.startedAt) || !isTimestamp(session.submittedAt)) return badRequest("invalid_request", "Invalid time of the attempt.");

  const key = task.getKey();
  if (!key) return json({ kind: "missing_key" } satisfies EvaluateResponse);
  const prompt = buildEvaluatorPrompt(role, key, session);
  // The evaluator shortens the record to fit; a prompt still over the budget means a record far
  // beyond any real attempt, and sending it would only cost money.
  if (Buffer.byteLength(prompt) > maxPromptBytes) return badRequest("prompt_too_large", "The record is too long to evaluate.", 413);
  const deadline = callDeadline(request);
  const full = await limitReachedResponse(limiter, "evaluate", request);
  if (full) return full;
  const budget = await reserveBudget(limiter, request, issues, worstCaseMicroUsd(evaluatorModel, prompt.length, maxOutputTokens.evaluate), deadline.signal, cutOffEstimator(evaluatorModel, prompt.length, maxOutputTokens.evaluate));
  if (budget instanceof Response) return budget;
  return settleAfter(budget, evaluateWithinBudget(request, deps, role, key, session, prompt, budget, deadline));
}

/** The evaluation itself, once its worst-case cost is held on the budget (handleEvaluate). */
async function evaluateWithinBudget(
  request: Request,
  { claude, limiter, issues }: HandlerDeps,
  role: RoleConfig,
  key: EvaluatorKey,
  session: z.infer<typeof TaskSession>,
  prompt: string,
  budget: BudgetReservation,
  deadline: CallDeadline,
): Promise<Response> {
  const limited = await limitResponse(limiter, "evaluate", request);
  if (limited) return limited;

  // A reply that is not readable JSON (about 1 in 90 in calibration) gets one more try; the
  // person should not lose one of the day's two evaluations to a glitch of the model.
  const call = measureCall(limiter.metrics, "evaluate");
  let raw: unknown;
  for (let attempt = 1; attempt <= 2 && raw === undefined && (attempt === 1 || (await mayTryAgain(deadline, budget))); attempt++) {
    let reply: string;
    try {
      reply = await claude.evaluate(prompt, {
        signal: deadline.signal,
        onUsage: (model, usage) => (call.usage(model, usage), budget.record(model, usage)),
      });
    } catch (error) {
      const failure = asClaudeError(error, deadline);
      await handleClaudeFailure({ limiter, issues }, "evaluate", request, failure);
      await call.finish(failure.code);
      return json({ kind: "error", code: failure.code, message: failure.message } satisfies EvaluateResponse);
    }
    raw = parseJsonReply(reply);
    if (raw === undefined) {
      console.warn(`Evaluation attempt ${attempt}: reply is not readable JSON.`);
      call.add("evaluate.unreadable_reply");
    }
  }
  if (raw === undefined) {
    // Our model failed twice, not the person: the attempt is given back.
    const attemptReturned = await giveBackToLimit(limiter, "evaluate", request, { afterPaidCalls: true });
    await call.finish("invalid_json");
    return json({ kind: "invalid", problems: ["invalid_json"], attemptReturned } satisfies EvaluateResponse);
  }
  const result = validateEvaluation(raw, role, key.traps, session.transcript, session.submission, session.reflection);
  if (!result.ok) {
    // The model's fault as much as unreadable JSON: the same once-a-day give-back.
    const attemptReturned = await giveBackToLimit(limiter, "evaluate", request, { afterPaidCalls: true });
    await call.finish("invalid_shape");
    return json({ kind: "invalid", problems: result.problems, attemptReturned } satisfies EvaluateResponse);
  }
  for (const [name, amount] of Object.entries(outcomeMetrics(role, session, result.evaluation))) call.add(name, amount);
  await call.finish("ok");

  if (isCustomTask(role)) await countCustomTask(limiter, "evaluated");

  // Revealed only now, after submission: what each trap was, for the result screen.
  const keyTraps = key.traps.map((trap) => ({
    id: trap.id,
    title: trap.title,
    whatIsWrong: trap.whatIsWrong,
    ...(typeof trap.naiveEffect === "string" ? { naiveEffect: trap.naiveEffect } : {}),
  }));
  const exampleToken = exampleTokenFor(role.id, limiter.secret);
  return json({ kind: "ok", evaluation: { ...result.evaluation, keyTraps, exampleToken } } satisfies EvaluateResponse);
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
