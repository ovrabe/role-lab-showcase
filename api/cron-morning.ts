import { handleMorning } from "../server/morningHandler.js";
import { getServerDeps, misconfiguredResponse } from "../server/deps.js";

// The morning Slack message (docs/PRODUCTION.md, part 11). Vercel calls it once a day ("crons"
// in vercel.json) with CRON_SECRET from the project settings. All logic is in server/.
export async function GET(request: Request): Promise<Response> {
  const deps = getServerDeps();
  if ("misconfigured" in deps) return misconfiguredResponse(deps.misconfigured);
  return handleMorning(request, { ...deps, cronSecret: process.env.CRON_SECRET?.trim() });
}
