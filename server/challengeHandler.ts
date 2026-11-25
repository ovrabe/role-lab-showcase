import { measureCall } from "./metrics.js";
import { z } from "zod";
import { buildChallengePrompt } from "../src/challenges/challengePrompt.js";
import { maxAnswerChars, minAnswerChars, validateChallengeReply, type ChallengeResult } from "../src/challenges/challengeResult.js";
import { asClaudeError, mayTryAgain, parseJsonReply, type HandlerDeps } from "./handlers.js";
import { badRequest, json, limitReachedResponse, limitResponse, readJson } from "./http.js";
import { handleClaudeFailure } from "./claudeFailure.js";
import { cutOffEstimator, reserveBudget, settleAfter, worstCaseMicroUsd, type BudgetReservation } from "./spendBudget.js";
import { callDeadline, challengeModel, maxOutputTokens, type CallDeadline } from "./claudeClient.js";
import type { ChallengeConfig, ChallengeKey } from "../src/challenges/challengeSchema.js";

/**
 * POST /api/challenge (docs/PRODUCTION.md, part 10, phase 2): one short challenge answer in,
 * one evaluation out. The browser sends only the challenge id and the answer; the server adds
 * the challenge's key, builds the instructions and calls the cheaper model. The key's trap
 * explanations go back only together with the result.
 */

const ChallengeRequest = z.object({
  challengeId: z.string(),
  answer: z.string().trim().min(minAnswerChars).max(maxAnswerChars),
});

/** Mirrors ChallengeOutcome in the page. */
export type ChallengeResponse =
  | { kind: "ok"; result: ChallengeResult }
  | { kind: "invalid"; problems: string[] }
  | { kind: "error"; code: string; message: string }
  | { kind: "missing_key" };

export async function handleChallenge(request: Request, deps: HandlerDeps): Promise<Response> {
  const { content, limiter, issues } = deps;
  const body = await readJson(request);
  if (body instanceof Response) return body;
  const parsed = ChallengeRequest.safeParse(body);
  if (!parsed.success) return badRequest("invalid_request", "Invalid challenge request.");
  const challenge = content.challenges.challenges.find((candidate) => candidate.id === parsed.data.challengeId);
  if (!challenge) return badRequest("unknown_challenge", "Unknown challenge.");

  const key = content.getChallengeKey(challenge.id);
  if (!key) return json({ kind: "missing_key" } satisfies ChallengeResponse);
  const prompt = buildChallengePrompt(challenge, key, parsed.data.answer);
  const deadline = callDeadline(request);
  const full = await limitReachedResponse(limiter, "challenge", request);
  if (full) return full;
  const budget = await reserveBudget(limiter, request, issues, worstCaseMicroUsd(challengeModel, prompt.length, maxOutputTokens.challenge), deadline.signal, cutOffEstimator(challengeModel, prompt.length, maxOutputTokens.challenge));
  if (budget instanceof Response) return budget;
  return settleAfter(budget, scoreChallenge(request, deps, challenge, key, parsed.data.answer, prompt, budget, deadline));
}

/** The scoring itself, once its worst-case cost is held on the budget (handleChallenge). */
async function scoreChallenge(
  request: Request,
  { claude, limiter, issues }: HandlerDeps,
  challenge: ChallengeConfig,
  key: ChallengeKey,
  answer: string,
  prompt: string,
  budget: BudgetReservation,
  deadline: CallDeadline,
): Promise<Response> {
  const limited = await limitResponse(limiter, "challenge", request);
  if (limited) return limited;

  // An unreadable reply (cut short, or broken JSON) gets one more try: it costs a fraction
  // of a crown and the person never sees the hiccup.
  const call = measureCall(limiter.metrics, "challenge");
  let raw: unknown;
  for (let attempt = 1; attempt <= 2 && raw === undefined && (attempt === 1 || (await mayTryAgain(deadline, budget))); attempt++) {
    try {
      raw = parseJsonReply(
        await claude.evaluateChallenge(prompt, {
          signal: deadline.signal,
          onUsage: (model, usage) => (call.usage(model, usage), budget.record(model, usage)),
        }),
      );
    } catch (error) {
      const failure = asClaudeError(error, deadline);
      await handleClaudeFailure({ limiter, issues }, "challenge", request, failure);
      await call.finish(failure.code);
      return json({ kind: "error", code: failure.code, message: failure.message } satisfies ChallengeResponse);
    }
  }
  if (raw === undefined) {
    await call.finish("invalid_json");
    return json({ kind: "invalid", problems: ["invalid_json"] } satisfies ChallengeResponse);
  }
  const result = validateChallengeReply(raw, key, answer);
  if (!result.ok) {
    await call.finish("invalid_shape");
    return json({ kind: "invalid", problems: result.problems } satisfies ChallengeResponse);
  }
  call.add(`challenge.${challenge.id}.count`);
  call.add(`challenge.${challenge.id}.score_sum`, result.result.score);
  call.add(`challenge.${challenge.id}.score.${result.result.score}`);
  await call.finish("ok");
  return json({ kind: "ok", result: result.result } satisfies ChallengeResponse);
}
