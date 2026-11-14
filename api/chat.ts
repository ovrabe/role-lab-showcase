import { handleChat } from "../server/handlers.js";
import { getServerDeps, misconfiguredResponse } from "../server/deps.js";

// Vercel function for the assistant (docs/SPEC.md, section 13). All logic is in server/.
export async function POST(request: Request): Promise<Response> {
  const deps = getServerDeps();
  if ("misconfigured" in deps) return misconfiguredResponse(deps.misconfigured);
  return handleChat(request, deps);
}
