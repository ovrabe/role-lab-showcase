import { handleFeedback } from "../server/feedback.js";
import { getServerDeps, misconfiguredResponse } from "../server/deps.js";

// Vercel function for "Share feedback" (docs/PRODUCTION.md, step 5). All logic is in server/.
export async function POST(request: Request): Promise<Response> {
  const deps = getServerDeps();
  if ("misconfigured" in deps) return misconfiguredResponse(deps.misconfigured);
  return handleFeedback(request, deps);
}
