import { z } from "zod";
import { buildChallengePrompt } from "../src/challenges/challengePrompt.js";
import { maxAnswerChars, minAnswerChars, validateChallengeReply, type ChallengeResult } from "../src/challenges/challengeResult.js";
import { asClaudeError, parseJsonReply, type HandlerDeps } from "./handlers.js";
import { badRequest, json, limitResponse, readJson } from "./http.js";
import { handleClaudeFailure } from "./claudeFailure.js";

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

export async function handleChallenge(request: Request, { content, claude, limiter, issues }: HandlerDeps): Promise<Response> {
  const body = await readJson(request);
  if (body instanceof Response) return body;
  const parsed = ChallengeRequest.safeParse(body);
  if (!parsed.success) return badRequest("invalid_request", "Invalid challenge request.");
  const challenge = content.challenges.challenges.find((candidate) => candidate.id === parsed.data.challengeId);
  if (!challenge) return badRequest("unknown_challenge", "Unknown challenge.");

  const key = content.getChallengeKey(challenge.id);
  if (!key) return json({ kind: "missing_key" } satisfies ChallengeResponse);
  const limited = await limitResponse(limiter, "challenge", request);
  if (limited) return limited;

  const { answer } = parsed.data;
  // An unreadable reply (cut short, or broken JSON) gets one more try: it costs a fraction
  // of a crown and the person never sees the hiccup.
  const prompt = buildChallengePrompt(challenge, key, answer);
  let raw: unknown;
  for (let attempt = 1; attempt <= 2 && raw === undefined; attempt++) {
    try {
      raw = parseJsonReply(await claude.evaluateChallenge(prompt, { signal: request.signal }));
    } catch (error) {
      const failure = asClaudeError(error);
      await handleClaudeFailure({ limiter, issues }, "challenge", request, failure);
      return json({ kind: "error", code: failure.code, message: failure.message } satisfies ChallengeResponse);
    }
  }
  if (raw === undefined) return json({ kind: "invalid", problems: ["invalid_json"] } satisfies ChallengeResponse);
  const result = validateChallengeReply(raw, key, answer);
  if (!result.ok) return json({ kind: "invalid", problems: result.problems } satisfies ChallengeResponse);
  return json({ kind: "ok", result: result.result } satisfies ChallengeResponse);
}
