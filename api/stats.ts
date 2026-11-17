import { handleStats } from "../server/statsHandler.js";
import { getServerDeps, misconfiguredResponse } from "../server/deps.js";

// Vercel function for the anonymous daily statistics. All logic is in server/.
export async function POST(request: Request): Promise<Response> {
  const deps = getServerDeps();
  if ("misconfigured" in deps) return misconfiguredResponse(deps.misconfigured);
  return handleStats(request, deps);
}
