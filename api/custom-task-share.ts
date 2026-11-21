import { handleCustomTaskShare } from "../server/customTaskShare.js";
import { getServerDeps, misconfiguredResponse } from "../server/deps.js";

// Vercel function for sharing custom tasks (docs/SPEC.md, section 14). All logic is in server/.
export async function POST(request: Request): Promise<Response> {
  const deps = getServerDeps();
  if ("misconfigured" in deps) return misconfiguredResponse(deps.misconfigured);
  return handleCustomTaskShare(request, deps);
}
