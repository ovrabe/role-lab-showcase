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
export const dailyBudgetUsd = { perIp: 1.5, total: 3 };
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

function budgetKeys(limiter: RateLimiter, request: Request) {
  const day = pragueDay(limiter);
  const ip = request.headers.get("x-real-ip")?.trim() || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const ipHash = createHmac("sha256", limiter.secret).update(ip).digest("hex").slice(0, 16);
  return [
    { key: `spend:${day}:ip:${ipHash}`, max: dailyBudgetUsd.perIp * 1_000_000, code: "limit_person" },
    { key: `spend:${day}:total`, max: dailyBudgetUsd.total * 1_000_000, code: "limit_daily" },
  ] as const;
}

/**
 * The most a call can cost, in micro-dollars: the prompt (about 2 characters a token, on the
 * safe side for Czech; priced as a cache write) plus the whole output allowance.
 */
export function worstCaseMicroUsd(model: string, promptChars: number, maxOutputTokens: number): number {
  const price = prices[model] ?? prices["claude-opus-5-5"];
  return Math.ceil((promptChars / 2) * price.input * cacheWriteFactor + maxOutputTokens * price.output);
}

/** Money held for one request until its calls report what they really cost. */
export type BudgetReservation = {
  /** Adds what a finished call cost (the onUsage of the Claude client). */
  record(model: string, usage: Usage): Promise<void>;
  /**
   * Replaces the held money with what was recorded. When the person cut the connection and no
   * cost was reported, Anthropic may still have billed the call, so `ifCutOff` (by default
   * the whole worst case) stays counted.
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
): Promise<Response | BudgetReservation> {
  const add = limiter.counter.add?.bind(limiter.counter);
  if (!add) return { record: async () => {}, settle: async () => {} };
  const keys = budgetKeys(limiter, request);
  const held: string[] = [];
  try {
    for (const { key, max, code } of keys) {
      held.push(key);
      // A call may start while today's spending (with what others hold) is under the ceiling,
      // as before holds existed: an honest person near the ceiling still gets their evaluation.
      // Parallel requests see each other's holds, so the day overshoots by one call at most.
      if ((await add(key, worstCase)) - worstCase >= max) {
        for (const heldKey of held) await add(heldKey, -worstCase);
        await alertOnce(limiter, issues, code);
        await addMetrics(limiter.metrics, { [`budget.refused.${code}`]: 1 });
        return badRequest(code, "Daily budget reached.", 429);
      }
    }
  } catch (error) {
    // Same rule as the call counts: no counter, no protection, no call.
    console.error("Budget counter failed:", error);
    return badRequest("service_unavailable", "Budget counter unavailable.", 503);
  }
  let recorded = false;
  let settled = false;
  return {
    async record(model, usage) {
      recorded = true;
      await recordSpend(limiter, request, model, usage);
    },
    async settle(ifCutOff = worstCase) {
      if (settled) return;
      settled = true;
      const keep = !recorded && request.signal.aborted ? Math.min(ifCutOff, worstCase) : 0;
      try {
        for (const { key } of keys) await add(key, keep - worstCase);
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
    for (const { key } of budgetKeys(limiter, request)) await limiter.counter.add(key, cost);
    const day = pragueDay(limiter);
    const spent = await limiter.counter.add(`spend:${day}:total`, 0);
    // Once a day, when the day's spending first passes 70 % of the ceiling.
    if (spent >= budgetWarningShare * dailyBudgetUsd.total * 1_000_000 && (await limiter.counter.add(`alert:${day}:budget_warning`, 1)) === 1) {
      await notify(limiter, "budget", `:money_with_wings: Dnešní útrata je ${(spent / 1_000_000).toFixed(2).replace(".", ",")} $ z ${dailyBudgetUsd.total} $ (přes 70 % stropu).`);
    }
  } catch (error) {
    console.error("Recording the spend failed:", error);
  }
}

async function alertOnce(limiter: RateLimiter, issues: IssueTracker | null | undefined, code: "limit_person" | "limit_daily"): Promise<void> {
  if (!issues || !limiter.counter.add) return;
  try {
    const day = pragueDay(limiter);
    if ((await limiter.counter.add(`alert:${day}:budget:${code}`, 1)) !== 1) return;
    const spent = (await limiter.counter.add(`spend:${day}:total`, 0)) / 1_000_000;
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
