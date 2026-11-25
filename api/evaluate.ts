import { handleEvaluate } from "../server/handlers.js";
import { getServerDeps, misconfiguredResponse } from "../server/deps.js";
import { logBotVerdict } from "../server/botCheck.js";

// Vercel function for the evaluator (docs/SPEC.md, section 13). All logic is in server/.
export async function POST(request: Request): Promise<Response> {
  const deps = getServerDeps();
  if ("misconfigured" in deps) return misconfiguredResponse(deps.misconfigured);
  await logBotVerdict("evaluate");
  return handleEvaluate(request, deps);
}
