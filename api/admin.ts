import { handleAdmin } from "../server/adminHandler.js";
import { getServerDeps, misconfiguredResponse } from "../server/deps.js";

// Vercel function for the admin page (docs/PRODUCTION.md, part 11). All logic is in server/.
export async function POST(request: Request): Promise<Response> {
  const deps = getServerDeps();
  if ("misconfigured" in deps) return misconfiguredResponse(deps.misconfigured);
  return handleAdmin(request, deps);
}
