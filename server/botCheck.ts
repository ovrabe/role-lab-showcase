import { checkBotId } from "botid/server";

/**
 * Vercel BotID (docs/PRODUCTION.md): asks Vercel whether a request came from a person or a bot.
 *
 * For now it only writes the verdict to the function log and never blocks anyone. We first want
 * to see on real traffic that the check works with our page (its browser script must get past
 * our Content Security Policy) and that it does not take people for bots. Blocking comes later.
 *
 * It never throws and never waits long: if BotID is down or slow, the request goes on as if
 * there were no check. The daily limits and the spending ceiling protect us either way.
 */
export type BotVerdict = "human" | "bot" | "verified-bot" | "unknown";

// bypassed: BotID did not ask Vercel at all (it thinks it runs in development) and says "human".
type BotIdResult = { isHuman: boolean; isBot: boolean; isVerifiedBot: boolean; bypassed?: boolean };
export type BotIdCheck = () => Promise<BotIdResult>;

// BotID itself answers in tens of milliseconds; anything slower must not hold up a person.
const timeoutMs = 1500;

export async function logBotVerdict(
  route: string,
  { check = () => checkBotId(), onVercel = Boolean(process.env.VERCEL), log = console.log }: { check?: BotIdCheck; onVercel?: boolean; log?: (line: string) => void } = {},
): Promise<BotVerdict> {
  // Locally and in the build check there is no Vercel to ask; BotID would only say "human".
  if (!onVercel) return "unknown";
  const startedAt = Date.now();
  let verdict: BotVerdict = "unknown";
  let problem: string | undefined;
  let skipped = false;
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
    }
  } catch (error) {
    // Only the first line: the message names the cause, the rest is a stack we do not need.
    problem = (error instanceof Error ? error.message : String(error)).split("\n")[0].slice(0, 200);
  } finally {
    clearTimeout(timer);
  }
  // No address, no headers: the route and the verdict are enough to see whether BotID works.
  log(JSON.stringify({ botid: verdict, route, ms: Date.now() - startedAt, ...(skipped ? { skipped } : {}), ...(problem ? { problem } : {}) }));
  return verdict;
}
