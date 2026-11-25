import { handleCustomTask } from "../server/customTaskHandler.js";
import { getServerDeps, misconfiguredResponse } from "../server/deps.js";
import { logBotVerdict } from "../server/botCheck.js";

// Vercel function for custom tasks (docs/SPEC.md, section 14). All logic is in server/.
export async function POST(request: Request): Promise<Response> {
  const deps = getServerDeps();
  if ("misconfigured" in deps) return misconfiguredResponse(deps.misconfigured);
  await logBotVerdict("custom-task");
  return handleCustomTask(request, deps);
}
