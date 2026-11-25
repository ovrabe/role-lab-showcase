import { clientAddress } from "./rateLimit.js";
import { notify } from "./notify.js";
import { addMetrics } from "./metrics.js";
import { createHmac } from "node:crypto";
import { badRequest } from "./http.js";
import type { RateLimiter } from "./rateLimit.js";
import type { IssueTracker } from "./issues.js";

/**
 * A daily spending ceiling in dollars, on top of the call counts in rateLimit.ts.
 * Call counts cannot tell a short call from a huge one: a script that sends long forged
 * conversations could spend the whole credit within the counts. Here every call adds what it
 * really cost (from the token counts Anthropic returns), and new calls stop once a day's
 * ceiling is reached: per IP address, so one source cannot use up the day, and in total.
 */
// An honest full day of one tester costs about 0.85 $. Raised from 1.50 $ and 3 $ on 24. 11. 2026,
// per address to 5 $ on 25. 11. 2026 (the author's decisions): four colleagues on one network,
// with room for the worst-case holds of evaluations running at once (about 0.84 $ each), so
// they are not told "try in a minute" while little is spent. Two addresses can use up the day.
export const dailyBudgetUsd = { perIp: 5, total: 8 };
// Refusals "too busy, try in a minute" a day after which the author is told: so many mean held
// money that is never given back (a crashed function), not a busy moment.
const busyRefusalsBeforeAlert = 20;
// Share of the daily ceiling at which the author gets a Slack notification.
const budgetWarningShare = 0.7;

// Dollars per million tokens (Claude API docs, November 2026). One token costs that many
// millionths of a dollar, so the counters hold whole micro-dollars.
const prices: Record<string, { input: number; output: number; cacheRead: number }> = {
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.1 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheRead: 0.01 },
};
// Writing the 5-minute cache costs 1.25x the input price.
const cacheWriteFactor = 1.25;

export type Usage = {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
};

/** What one call cost, in micro-dollars. An unknown model is priced like the dearest one. */
export function costMicroUsd(model: string, usage: Usage): number {
  const price = prices[model] ?? prices["claude-opus-5-5"];
  return Math.ceil(
    usage.input_tokens * price.input +
      (usage.cache_creation_input_tokens ?? 0) * price.input * cacheWriteFactor +
      (usage.cache_read_input_tokens ?? 0) * price.cacheRead +
      usage.output_tokens * price.output,
  );
}

const pragueDay = (limiter: RateLimiter) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Prague" }).format((limiter.now ?? (() => new Date()))());

// Two counters per ceiling: `key` holds what was spent plus what running calls hold (the
// ceiling is checked against it), `spentKey` only what calls really cost (shown to the author,
// and telling a spent day from a busy moment).
function budgetKeys(limiter: RateLimiter, request: Request) {
  const day = pragueDay(limiter);
  const ip = clientAddress(request);
  const ipHash = createHmac("sha256", limiter.secret).update(ip).digest("hex").slice(0, 16);
  return [
    { key: `spend:${day}:ip:${ipHash}`, spentKey: `spent:${day}:ip:${ipHash}`, max: dailyBudgetUsd.perIp * 1_000_000, code: "limit_person" },
    { key: `spend:${day}:total`, spentKey: `spent:${day}:total`, max: dailyBudgetUsd.total * 1_000_000, code: "limit_daily" },
  ] as const;
}

/** What today's calls have really cost so far, in micro-dollars, without running calls' holds. */
export async function spentTodayMicroUsd(limiter: RateLimiter): Promise<number> {
  return limiter.counter.add ? limiter.counter.add(`spent:${pragueDay(limiter)}:total`, 0) : 0;
}

/**
 * The most a call can cost, in micro-dollars: the prompt (about 2 characters a token, on the
 * safe side for Czech; priced as a cache write) plus the whole output allowance.
 */
export function worstCaseMicroUsd(model: string, promptChars: number, maxOutputTokens: number): number {
  const price = prices[model] ?? prices["claude-opus-5-5"];
  return Math.ceil((promptChars / 2) * price.input * cacheWriteFactor + maxOutputTokens * price.output);
}

/**
 * What a call cut off after `elapsedMs` probably cost: the whole prompt plus what the model can
 * write in that time (about 100 tokens a second, thinking included), never more than the whole
 * allowance. Keeping the full worst case charged an honest person who closed the tab during an
 * evaluation about 0.70 $ for nothing (review of 24. 11. 2026).
 */
export function cutOffEstimator(model: string, promptChars: number, maxOutputTokens: number): (elapsedMs: number) => number {
  return (elapsedMs) => worstCaseMicroUsd(model, promptChars, Math.min(maxOutputTokens, Math.ceil((elapsedMs / 1000) * 100)));
}

/** Money held for one request until its calls report what they really cost. */
export type BudgetReservation = {
  /** Adds what a finished call cost (the onUsage of the Claude client). */
  record(model: string, usage: Usage): Promise<void>;
  /**
   * Holds the worst case once more, before a second try of the call: each call a request makes
   * must be covered by a hold. False when the ceiling does not allow it (then do not retry).
   */
  holdAnother(): Promise<boolean>;
  /**
   * Gives back all the held money; what was recorded stays. When the call was cut off (the
   * person left, or the deadline) before it reported its cost, Anthropic may still have billed
   * it, so an estimate stays counted: `ifCutOff`, or the estimator given to reserveBudget, or
   * at most the worst case.
   */
  settle(ifCutOff?: number): Promise<void>;
};

/**
 * Holds a call's worst-case cost on today's budget before the call, or returns the refusal.
 * Holding before calling (one atomic increment per ceiling) means requests sent at the same
 * moment cannot all slip under the ceiling: each sees the money the others hold.
 * Without holds (until 2.5.0), 150 chats sent at once all saw an untouched budget.
 * The first refusal of the day for each ceiling files a backlog issue, so the author learns
 * whether it is interest (raise the ceiling) or one source hammering the server.
 */
export async function reserveBudget(
  limiter: RateLimiter,
  request: Request,
  issues: IssueTracker | null | undefined,
  worstCase: number,
  // Aborted when the call was cut off: by the person, or by the request's deadline (claudeClient.ts).
  cutOff: AbortSignal = request.signal,
  estimateCutOff?: (elapsedMs: number) => number,
): Promise<Response | BudgetReservation> {
  const maybeAdd = limiter.counter.add?.bind(limiter.counter);
  if (!maybeAdd) return { record: async () => {}, holdAnother: async () => true, settle: async () => {} };
  const add = maybeAdd;
  const keys = budgetKeys(limiter, request);

  // One more hold of the worst case on every ceiling, or the refusal to send. `quiet` for the
  // second try of a call: the person was not refused anything, so no issue and no metric.
  async function hold(quiet = false): Promise<Response | null> {
    const held: string[] = [];
    for (const { key, max } of keys) {
      held.push(key);
      // A call may start while today's spending (with what others hold) is under the ceiling,
      // as before holds existed: an honest person near the ceiling still gets their evaluation.
      // Parallel requests see each other's holds, so the day overshoots by one call at most.
      if ((await add(key, worstCase)) - worstCase >= max) {
        for (const heldKey of held) await add(heldKey, -worstCase);
        if (quiet) return badRequest("budget_busy", "No room for another try.", 429);
        return refusal();
      }
    }
    return null;
  }

  // Why the money is not there: the day is really spent (everyone's total first, then this
  // address's share), or only held by running calls, a busy moment the page asks to wait out.
  async function refusal(): Promise<Response> {
    for (const { spentKey, max, code } of [...keys].reverse()) {
      if ((await add(spentKey, 0)) >= max) {
        await alertOnce(limiter, issues, code);
        await addMetrics(limiter.metrics, { [`budget.refused.${code}`]: 1 });
        return badRequest(code, "Daily budget reached.", 429);
      }
    }
    await addMetrics(limiter.metrics, { "budget.refused.busy": 1 });
    await alertStuckHolds(limiter, issues);
    return badRequest("budget_busy", "Too many calls running at once.", 429);
  }

  try {
    const refusal = await hold();
    if (refusal) return refusal;
  } catch (error) {
    // Same rule as the call counts: no counter, no protection, no call.
    console.error("Budget counter failed:", error);
    return badRequest("service_unavailable", "Budget counter unavailable.", 503);
  }
  let startedAt = Date.now();
  let holds = 1;
  let records = 0;
  let settled = false;
  return {
    async record(model, usage) {
      records += 1;
      await recordSpend(limiter, request, model, usage);
    },
    async holdAnother() {
      try {
        if (await hold(true)) return false;
        holds += 1;
        // A cut-off estimate counts from the start of this try, not of the request.
        startedAt = Date.now();
        return true;
      } catch (error) {
        console.error("Budget counter failed:", error);
        return false;
      }
    },
    async settle(ifCutOff) {
      if (settled) return;
      settled = true;
      // One call, the last, can have been cut off before it reported its cost.
      const unreported = cutOff.aborted && records < holds;
      const estimate = ifCutOff ?? estimateCutOff?.(Date.now() - startedAt) ?? worstCase;
      const keep = unreported ? Math.min(estimate, worstCase) : 0;
      try {
        for (const { key, spentKey } of keys) {
          await add(key, keep - worstCase * holds);
          if (keep > 0) await add(spentKey, keep);
        }
      } catch (error) {
        // The held money stays counted: safe for the credit, at worst a stricter day.
        console.error("Releasing the budget hold failed:", error);
      }
    },
  };
}

/** Runs the work and always gives back what the budget still holds for it, whatever happens. */
export async function settleAfter(budget: BudgetReservation, work: Promise<Response>): Promise<Response> {
  try {
    return await work;
  } finally {
    await budget.settle();
  }
}

/** Adds what a finished call cost. Never fails the call: a lost record is only logged. */
export async function recordSpend(limiter: RateLimiter, request: Request, model: string, usage: Usage): Promise<void> {
  if (!limiter.counter.add) return;
  const cost = costMicroUsd(model, usage);
  try {
    let spent = 0;
    for (const { key, spentKey } of budgetKeys(limiter, request)) {
      await limiter.counter.add(key, cost);
      spent = await limiter.counter.add(spentKey, cost);
    }
    const day = pragueDay(limiter);
    // Once a day, when the day's spending first passes 70 % of the ceiling.
    if (spent >= budgetWarningShare * dailyBudgetUsd.total * 1_000_000 && (await limiter.counter.add(`alert:${day}:budget_warning`, 1)) === 1) {
      await notify(limiter, "budget", `:money_with_wings: Dnešní útrata je ${(spent / 1_000_000).toFixed(2).replace(".", ",")} $ z ${dailyBudgetUsd.total} $ (přes 70 % stropu).`);
    }
  } catch (error) {
    console.error("Recording the spend failed:", error);
  }
}

/** Files one issue a day when "try in a minute" refusals pile up: held money is stuck. */
async function alertStuckHolds(limiter: RateLimiter, issues: IssueTracker | null | undefined): Promise<void> {
  if (!issues || !limiter.counter.add) return;
  try {
    const day = pragueDay(limiter);
    if ((await limiter.counter.add(`budget-busy:${day}`, 1)) !== busyRefusalsBeforeAlert) return;
    await issues.create({
      title: "Denní rozpočet: mnoho odmítnutí „zkus to za minutu“",
      body: [
        `Dnes už ${busyRefusalsBeforeAlert}× odmítl server volání, protože peníze drží běžící volání, ne skutečná útrata.`,
        "Když to trvá déle než pár minut, rezervace nejspíš uvízla (funkce spadla dřív, než ji vrátila). Uvolní se o půlnoci.",
        "",
        "Co udělat: v adminu porovnej skutečnou útratu se stropem; v logu Vercelu hledej „Releasing the budget hold failed“.",
        "",
        "Tohle issue vzniká nejvýš jednou denně. Po přečtení ho zavři.",
      ].join("\n"),
      labels: ["provoz"],
    });
  } catch (error) {
    console.error("Filing the stuck-holds issue failed:", error);
  }
}

async function alertOnce(limiter: RateLimiter, issues: IssueTracker | null | undefined, code: "limit_person" | "limit_daily"): Promise<void> {
  if (!issues || !limiter.counter.add) return;
  try {
    const day = pragueDay(limiter);
    if ((await limiter.counter.add(`alert:${day}:budget:${code}`, 1)) !== 1) return;
    const spent = (await spentTodayMicroUsd(limiter)) / 1_000_000;
    const whose = code === "limit_person" ? `jedna IP adresa (strop ${dailyBudgetUsd.perIp} $)` : `všichni dohromady (strop ${dailyBudgetUsd.total} $)`;
    await issues.create({
      title: code === "limit_person" ? "Denní rozpočet: jedna adresa vyčerpala svůj podíl" : "Denní rozpočet: vyčerpaný pro všechny",
      body: [
        `Dnes se vyčerpal denní rozpočet na volání Clauda: ${whose}.`,
        `Celkem dnes utraceno: ${spent.toFixed(2)} $ z ${dailyBudgetUsd.total} $.`,
        "",
        code === "limit_person"
          ? "Lidé z té adresy dostávají až do půlnoci hlášku o vyčerpaném limitu, ostatní pokračují. Když je to jeden tester s několika pokusy, je to v pořádku. Když se to opakuje každý den, může jít o zneužití."
          : "Až do půlnoci dostávají všichni hlášku o vyčerpaném denním limitu. Když jde o zájem testerů, zvaž zvýšení stropu v server/spendBudget.ts (a dobití kreditu).",
        "",
        "Tohle issue vzniká nejvýš jednou denně pro každý strop. Po přečtení ho zavři.",
      ].join("\n"),
      labels: ["provoz"],
    });
  } catch (error) {
    console.error("Filing the budget issue failed:", error);
  }
}
