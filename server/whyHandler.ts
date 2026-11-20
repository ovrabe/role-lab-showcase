import { z } from "zod";
import { TaskSession } from "../src/session/sessionSchema.js";
import { buildWhyPrompt } from "../src/prompts/why.js";
import { validateWhyReply, type StoredWhy } from "../src/evaluation/whyAnswer.js";
import { asClaudeError, isTimestamp, parseJsonReply, transcriptProblem, type HandlerDeps } from "./handlers.js";
import { badRequest, json, limitResponse, readJson } from "./http.js";
import { budgetResponse, recordSpend } from "./spendBudget.js";
import { handleClaudeFailure } from "./claudeFailure.js";

/**
 * "Proč tohle skóre?" on the web (docs/PROMPTS.md, section 5): the page sends the attempt and
 * the area, the server builds the prompt and asks the quick model (the same call as challenges),
 * checks the answer and its quotes. Same guards as the other Claude calls: size, times, daily
 * limits and the spending budget.
 */
const WhyRequest = z.object({ roleId: z.string().max(60), session: TaskSession, dimensionId: z.string().max(40) });

export type WhyResponse = { kind: "ok"; why: StoredWhy } | { kind: "error"; code: string; message: string };

export async function handleWhy(request: Request, { content, claude, limiter, issues }: HandlerDeps): Promise<Response> {
  const body = await readJson(request, 4_000_000);
  if (body instanceof Response) return body;
  const parsed = WhyRequest.safeParse(body);
  if (!parsed.success) return badRequest("invalid_request", "Invalid request.");
  const role = content.roles.activeRoles.find((candidate) => candidate.id === parsed.data.roleId);
  if (!role) return badRequest("unknown_role", "Unknown role.");
  const { session, dimensionId } = parsed.data;
  if (session.roleId !== role.id) return badRequest("invalid_request", "Session belongs to another role.");
  const problem = transcriptProblem(role, session.transcript);
  if (problem) return badRequest("invalid_request", problem);
  if (!isTimestamp(session.startedAt)) return badRequest("invalid_request", "Invalid time of the attempt.");
  const prompt = buildWhyPrompt(role, session, dimensionId);
  if (!prompt) return badRequest("invalid_request", "No evaluated area to explain.");

  const overBudget = await budgetResponse(limiter, request, issues);
  if (overBudget) return overBudget;
  const limited = await limitResponse(limiter, "why", request);
  if (limited) return limited;

  let reply: string;
  try {
    reply = await claude.evaluateChallenge(prompt, { signal: request.signal, onUsage: (model, usage) => recordSpend(limiter, request, model, usage) });
  } catch (error) {
    const failure = asClaudeError(error);
    await handleClaudeFailure({ limiter, issues }, "why", request, failure);
    return json({ kind: "error", code: failure.code, message: failure.message } satisfies WhyResponse);
  }
  const why = validateWhyReply(parseJsonReply(reply), session);
  if (!why) return json({ kind: "error", code: "invalid_json", message: "Unreadable explanation." } satisfies WhyResponse);
  return json({ kind: "ok", why } satisfies WhyResponse);
}
