import { notify } from "./notify.js";
import type { ClaudeError } from "./claudeClient.js";
import type { IssueTracker } from "./issues.js";
import { giveBackToLimit, type LimitedAction, type RateLimiter } from "./rateLimit.js";

/**
 * What the server does when a call to Claude fails, the same for chat, evaluation and
 * challenges:
 * - logs the code (never the person's text), so the author can see it in the Vercel logs;
 * - gives the attempt back when Claude wrote nothing, so an outage on our side does not
 *   use up the person's daily limit;
 * - when the API is unusable for everyone (credit used up, key rejected), files one
 *   backlog issue a day, so the author learns about it without watching the logs.
 */

// Failures where Claude produced nothing and the person did nothing wrong.
const ourOutages = new Set(["upstream_error", "rate_limited", "ai_unavailable"]);

export type FailureDeps = { limiter: RateLimiter; issues?: IssueTracker | null };

export async function handleClaudeFailure(
  { limiter, issues = null }: FailureDeps,
  action: LimitedAction,
  request: Request,
  error: ClaudeError,
  now: () => Date = () => new Date(),
): Promise<void> {
  if (error.code === "cancelled") return;
  console.error(`Claude call failed (${action}): ${error.code} – ${error.reason ?? error.message}`);
  // The person's own mistakes (too long, refused) are not an outage; these are.
  if (ourOutages.has(error.code) || error.code === "overloaded") {
    await notify(limiter, "model_error", `:warning: Volání modelu selhává (${action}: ${error.code}). Podrobnosti v adminu, záložka Modely a útrata.`);
  }

  if (ourOutages.has(error.code) && !error.text) {
    try {
      await giveBackToLimit(limiter, action, request);
    } catch (giveBackError) {
      console.error("Giving the attempt back failed:", giveBackError);
    }
  }

  if (error.code === "ai_unavailable" && issues) {
    try {
      // The first failure of the day files the issue; the counter keeps the rest quiet.
      const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Prague" }).format(now());
      const count = await limiter.counter.increment(`alert:${day}:ai_unavailable`);
      if (count === 1) await issues.create(unavailableIssue(error.reason ?? error.message));
    } catch (alertError) {
      console.error("Filing the outage issue failed:", alertError);
    }
  }
}

function unavailableIssue(reason: string) {
  return {
    title: "AI je nedostupná: došel kredit, nebo server odmítl API klíč",
    body: [
      "Volání Clauda na webu selhává pro všechny. Lidé vidí hlášku, že AI je dočasně nedostupná, a jejich pokusy se nepočítají do denního limitu.",
      "",
      `Důvod podle Anthropic API: ${reason}`,
      "",
      "Co udělat:",
      "1. V Anthropic Console zkontroluj zůstatek kreditu a případně ho dobij.",
      "2. Když je kredit v pořádku, zkontroluj, jestli API klíč neexpiroval, a ve Vercelu ho vyměň (ANTHROPIC_API_KEY, pak Redeploy).",
      "",
      "Tohle issue vzniká nejvýš jednou denně. Po opravě ho zavři.",
    ].join("\n"),
    labels: ["provoz"],
  };
}
