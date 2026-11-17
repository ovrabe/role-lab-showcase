import { handleExample } from "../server/exampleHandler.js";
import { getServerDeps, misconfiguredResponse } from "../server/deps.js";

// Vercel function for the strong sample on the result screen. All logic is in server/.
export async function POST(request: Request): Promise<Response> {
  const deps = getServerDeps();
  if ("misconfigured" in deps) return misconfiguredResponse(deps.misconfigured);
  return handleExample(request, deps);
}
