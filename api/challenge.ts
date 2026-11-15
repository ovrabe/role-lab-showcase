import { handleChallenge } from "../server/challengeHandler.js";
import { getServerDeps, misconfiguredResponse } from "../server/deps.js";

// Vercel function for short challenges (docs/PRODUCTION.md, part 10). All logic is in server/.
export async function POST(request: Request): Promise<Response> {
  const deps = getServerDeps();
  if ("misconfigured" in deps) return misconfiguredResponse(deps.misconfigured);
  return handleChallenge(request, deps);
}
