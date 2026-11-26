import { handleWhy } from "../server/whyHandler.js";
import { getServerDeps, misconfiguredResponse } from "../server/deps.js";
import { logBotVerdict } from "../server/botCheck.js";

// Vercel function for "Proč tohle skóre?". All logic is in server/.
export async function POST(request: Request): Promise<Response> {
  const deps = getServerDeps();
  if ("misconfigured" in deps) return misconfiguredResponse(deps.misconfigured);
  await logBotVerdict("why", { metrics: deps.limiter.metrics });
  return handleWhy(request, deps);
}
