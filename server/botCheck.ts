import { checkBotId } from "botid/server";
import { addMetrics, type MetricsStore } from "./metrics.js";

/**
 * Vercel BotID (docs/PRODUCTION.md): asks Vercel whether a request came from a person or a bot.
 *
 * For now it only writes the verdict to the function log and never blocks anyone. We first want
 * to see on real traffic that the check works with our page (its browser script must get past
 * our Content Security Policy) and that it does not take people for bots. Blocking comes later.
 *
 * Each verdict is also counted in the anonymous daily metrics (server/metrics.ts, 90 days), so
 * the admin shows weeks of verdicts; the function log on Vercel keeps only about an hour.
 *
 * It never throws and never waits long: if BotID is down or slow, the request goes on as if
 * there were no check. The daily limits and the spending ceiling protect us either way.
 */
export type BotVerdict = "human" | "bot" | "verified-bot" | "unknown";

// bypassed: BotID did not ask Vercel at all (it thinks it runs in development) and says "human".
// verifiedBotName: for a known good bot (a search engine, a monitor), the name Vercel verified.
type BotIdResult = { isHuman: boolean; isBot: boolean; isVerifiedBot: boolean; bypassed?: boolean; verifiedBotName?: string };

// A known bot's name as a metric name: short, lowercase letters, digits and dashes only, so a
// strange name can never make a long or odd key in the database.
export function botNameKey(name: string | undefined): string {
  const key = (name ?? "").slice(0, 200).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  return key || "unnamed";
}
export type BotIdCheck = () => Promise<BotIdResult>;

// BotID itself answers in tens of milliseconds; anything slower must not hold up a person.
const timeoutMs = 1500;

export async function logBotVerdict(
  route: string,
  {
    check = () => checkBotId(),
    onVercel = Boolean(process.env.VERCEL),
    log = console.log,
    metrics = null,
  }: { check?: BotIdCheck; onVercel?: boolean; log?: (line: string) => void; metrics?: MetricsStore | null } = {},
): Promise<BotVerdict> {
  // Locally and in the build check there is no Vercel to ask; BotID would only say "human".
  if (!onVercel) return "unknown";
  const startedAt = Date.now();
  let verdict: BotVerdict = "unknown";
  let problem: string | undefined;
  let skipped = false;
  let knownBot: string | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timedOut = new Promise<"timeout">((resolve) => {
      timer = setTimeout(() => resolve("timeout"), timeoutMs);
    });
    const result = await Promise.race([check(), timedOut]);
    if (result === "timeout") problem = "timeout";
    else {
      verdict = result.isVerifiedBot ? "verified-bot" : result.isBot ? "bot" : result.isHuman ? "human" : "unknown";
      // Without this a log full of "human" could mean BotID never checked anything.
      skipped = result.bypassed === true;
      if (verdict === "verified-bot") knownBot = botNameKey(result.verifiedBotName);
    }
  } catch (error) {
    // Only the first line: the message names the cause, the rest is a stack we do not need.
    problem = (error instanceof Error ? error.message : String(error)).split("\n")[0].slice(0, 200);
  } finally {
    clearTimeout(timer);
  }
  // No address, no headers: the route and the verdict are enough to see whether BotID works.
  log(JSON.stringify({ botid: verdict, route, ms: Date.now() - startedAt, ...(knownBot ? { knownBot } : {}), ...(skipped ? { skipped } : {}), ...(problem ? { problem } : {}) }));
  // Counts only, no route and no address: enough to see whether BotID works and how many bots come.
  await addMetrics(metrics, {
    [`botid.${verdict}`]: 1,
    ...(knownBot ? { [`botid.known.${knownBot}`]: 1 } : {}),
    ...(skipped ? { "botid.skipped": 1 } : {}),
    ...(problem ? { "botid.problem": 1 } : {}),
  });
  return verdict;
}
