import { measureCall } from "./metrics.js";
import { z } from "zod";
import { TaskSession } from "../src/session/sessionSchema.js";
import { buildWhyPrompt } from "../src/prompts/why.js";
import { validateWhyReply, type StoredWhy } from "../src/evaluation/whyAnswer.js";
import { asClaudeError, isTimestamp, maxSubmissionChars, parseJsonReply, resolveTask, transcriptProblem, type HandlerDeps } from "./handlers.js";
import { maxPromptBytes } from "../src/assistant/promptBudget.js";
import { badRequest, json, limitReachedResponse, limitResponse, readJson } from "./http.js";
import { cutOffEstimator, reserveBudget, settleAfter, worstCaseMicroUsd, type BudgetReservation } from "./spendBudget.js";
import { callDeadline, challengeModel, maxOutputTokens, type CallDeadline } from "./claudeClient.js";
import { handleClaudeFailure } from "./claudeFailure.js";

/**
 * "Proč tohle skóre?" on the web (docs/PROMPTS.md, section 5): the page sends the attempt and
 * the area, the server builds the prompt and asks the quick model (the same call as challenges),
 * checks the answer and its quotes. Same guards as the other Claude calls: size, times, daily
 * limits and the spending budget.
 */
const WhyRequest = z.object({ roleId: z.string().max(60), session: TaskSession, dimensionId: z.string().max(40) });

export type WhyResponse = { kind: "ok"; why: StoredWhy } | { kind: "error"; code: string; message: string };

export async function handleWhy(request: Request, deps: HandlerDeps): Promise<Response> {
  const { limiter, issues } = deps;
  const body = await readJson(request, 4_000_000);
  if (body instanceof Response) return body;
  const parsed = WhyRequest.safeParse(body);
  if (!parsed.success) return badRequest("invalid_request", "Invalid request.");
  // A fixed task or a generated custom task, the same lookup as chat and evaluation.
  const role = (await resolveTask(deps, parsed.data.roleId))?.role;
  if (!role) return badRequest("unknown_role", "Unknown role.");
  const { session, dimensionId } = parsed.data;
  if (session.roleId !== role.id) return badRequest("invalid_request", "Session belongs to another role.");
  const problem = transcriptProblem(role, session.transcript);
  if (problem) return badRequest("invalid_request", problem);
  if (!isTimestamp(session.startedAt)) return badRequest("invalid_request", "Invalid time of the attempt.");
  if (session.submission.length > maxSubmissionChars) return badRequest("too_large", "Submission too long.", 413);
  const prompt = buildWhyPrompt(role, session, dimensionId);
  if (!prompt) return badRequest("invalid_request", "No evaluated area to explain.");
  // The same ceiling as the evaluator's prompt: a bigger one is no real attempt (until 2.5.1
  // a 3 MB explanation prompt went through).
  if (Buffer.byteLength(prompt) > maxPromptBytes) return badRequest("prompt_too_large", "The record is too long to explain.", 413);

  // The quick model, the same call as challenges.
  const deadline = callDeadline(request);
  const full = await limitReachedResponse(limiter, "why", request);
  if (full) return full;
  const budget = await reserveBudget(limiter, request, issues, worstCaseMicroUsd(challengeModel, prompt.length, maxOutputTokens.challenge), deadline.signal, cutOffEstimator(challengeModel, prompt.length, maxOutputTokens.challenge));
  if (budget instanceof Response) return budget;
  return settleAfter(budget, explainScore(request, deps, session, prompt, budget, deadline));
}

/** The explanation itself, once its worst-case cost is held on the budget (handleWhy). */
async function explainScore(
  request: Request,
  { claude, limiter, issues }: HandlerDeps,
  session: z.infer<typeof TaskSession>,
  prompt: string,
  budget: BudgetReservation,
  deadline: CallDeadline,
): Promise<Response> {
  const limited = await limitResponse(limiter, "why", request);
  if (limited) return limited;

  const call = measureCall(limiter.metrics, "why");
  let reply: string;
  try {
    reply = await claude.evaluateChallenge(prompt, {
      signal: deadline.signal,
      onUsage: (model, usage) => (call.usage(model, usage), budget.record(model, usage)),
    });
  } catch (error) {
    const failure = asClaudeError(error, deadline);
    await handleClaudeFailure({ limiter, issues }, "why", request, failure);
    await call.finish(failure.code);
    return json({ kind: "error", code: failure.code, message: failure.message } satisfies WhyResponse);
  }
  const why = validateWhyReply(parseJsonReply(reply), session);
  await call.finish(why ? "ok" : "invalid_json");
  if (!why) return json({ kind: "error", code: "invalid_json", message: "Unreadable explanation." } satisfies WhyResponse);
  return json({ kind: "ok", why } satisfies WhyResponse);
}
