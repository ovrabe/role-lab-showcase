import { createHmac } from "node:crypto";
import type { MetricsStore } from "./metrics.js";
import { upstashTransaction } from "./upstash.js";

/**
 * Daily limits for the web build (docs/PRODUCTION.md, section 3, point 6). Every call to
 * Claude costs the author money, so the server counts calls per person and in total and
 * refuses once a limit is reached. The numbers live here and nowhere else.
 */
export const dailyLimits = {
  // Per person: two full attempts (25 messages each), two evaluations, a few feedback notes.
  // Short challenges use the cheap model: enough for every challenge once a day.
  // Strong samples (exampleHandler.ts) cost no Claude call; the limit only stops scripts.
  // Anonymous statistics (statsHandler.ts): a few events per attempt, the limit only stops scripts.
  // "Proč tohle skóre?" uses the cheap model: a few questions per result are plenty.
  // A custom task (docs/SPEC.md, section 14) is the dearest single call after the evaluator:
  // about 0.2 $, so 5 a day keep most of the daily budget (spendBudget.ts) for the fixed tasks.
  // Its status is read on every visit of the link; asking to share it opens a GitHub issue.
  perPerson: { chat: 50, evaluate: 2, feedback: 5, challenge: 15, example: 30, stats: 300, why: 15, customTask: 1, customTaskStatus: 60, customTaskShare: 3 },
  // For everyone together: a ceiling on what one day can cost (and on feedback spam).
  total: { chat: 150, evaluate: 5, feedback: 100, challenge: 300, example: 1000, stats: 20000, why: 300, customTask: 5, customTaskStatus: 3000, customTaskShare: 30 },
};

export type LimitedAction = keyof typeof dailyLimits.perPerson;
export type LimitCode = "limit_person" | "limit_daily";

/**
 * Adds one to a counter and returns the new value. Counters are dropped after two days.
 * decrement gives one back (see giveBackToLimit); a counter without it just keeps the count.
 */
export type Counter = {
  increment(key: string): Promise<number>;
  decrement?(key: string): Promise<void>;
  // Adds any amount and returns the new value; add(key, 0) reads it (server/spendBudget.ts).
  add?(key: string, amount: number): Promise<number>;
  // Reads several counters at once, 0 for a missing one (the daily statistics, statsHandler.ts).
  readMany?(keys: string[]): Promise<number[]>;
};

export type RateLimiter = {
  counter: Counter;
  // Secret mixed into the person id, so stored ids cannot be turned back into IP addresses.
  secret: string;
  limits?: typeof dailyLimits;
  now?: () => Date;
  // Anonymous daily metrics for the admin page (server/metrics.ts). Kept here because every
  // handler already has the limiter; without it nothing is measured.
  metrics?: MetricsStore | null;
};

const keyLifetimeSeconds = 2 * 24 * 60 * 60;

/** Counters in this process's memory: for local development and tests only. */
export function memoryCounter(): Counter {
  const counts = new Map<string, number>();
  return {
    async increment(key) {
      const next = (counts.get(key) ?? 0) + 1;
      counts.set(key, next);
      return next;
    },
    async decrement(key) {
      counts.set(key, (counts.get(key) ?? 0) - 1);
    },
    async add(key, amount) {
      const next = (counts.get(key) ?? 0) + amount;
      counts.set(key, next);
      return next;
    },
    async readMany(keys) {
      return keys.map((key) => counts.get(key) ?? 0);
    },
  };
}

/**
 * Counters in Upstash Redis over its REST API (https://upstash.com/docs/redis/features/restapi).
 * INCR and EXPIRE go in one transaction, so a counter never stays without an expiry.
 */
export function upstashCounter(url: string, token: string): Counter {
  return {
    async increment(key) {
      const [value] = await upstashTransaction(url, token, [
        ["INCR", key],
        ["EXPIRE", key, String(keyLifetimeSeconds)],
      ]);
      if (typeof value !== "number") throw new Error("Upstash returned no counter value");
      return value;
    },
    async decrement(key) {
      await upstashTransaction(url, token, [["DECR", key]]);
    },
    async add(key, amount) {
      const [value] = await upstashTransaction(url, token, [
        ["INCRBY", key, String(Math.round(amount))],
        ["EXPIRE", key, String(keyLifetimeSeconds)],
      ]);
      if (typeof value !== "number") throw new Error("Upstash returned no counter value");
      return value;
    },
    async readMany(keys) {
      if (keys.length === 0) return [];
      const [values] = await upstashTransaction(url, token, [["MGET", ...keys]]);
      return (values as (string | null)[]).map((value) => Number(value ?? 0));
    },
  };
}

// The day as people in Czechia see it, so "try again tomorrow" means after local midnight.
function pragueDay(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Prague" }).format(date);
}

// Who is behind a request. The page sends a random number its browser keeps
// (src/ai/apiHeaders.ts), so people sharing one network (an office, a home) each get their own
// limit. A script can invent a new number for every call, so each IP address also has a ceiling
// of a few people's worth. Without the number (an old page), the IP address is the person.
// Vercel sets x-real-ip and x-forwarded-for itself; locally there is none ("unknown").
// Only short keyed hashes are stored, so the counters cannot be turned back into either value.
const sharedNetworkPeople = 4;
const browserIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const hashed = (value: string, secret: string) => createHmac("sha256", secret).update(value).digest("hex").slice(0, 16);
const ipOf = (request: Request) =>
  request.headers.get("x-real-ip")?.trim() || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
function browserOf(request: Request): string | null {
  const id = request.headers.get("x-role-lab-browser")?.trim() ?? "";
  return browserIdPattern.test(id) ? id : null;
}

// The counters one call goes against, with their ceilings, in the order they are checked.
function limitKeys(limiter: RateLimiter, action: LimitedAction, request: Request) {
  const limits = limiter.limits ?? dailyLimits;
  const day = pragueDay((limiter.now ?? (() => new Date()))());
  const ip = hashed(ipOf(request), limiter.secret);
  const browser = browserOf(request);
  const keys: { key: string; max: number; code: LimitCode }[] = browser
    ? [
        { key: `rl:${day}:${action}:browser:${hashed(browser, limiter.secret)}`, max: limits.perPerson[action], code: "limit_person" },
        { key: `rl:${day}:${action}:person:${ip}`, max: limits.perPerson[action] * sharedNetworkPeople, code: "limit_person" },
      ]
    : [{ key: `rl:${day}:${action}:person:${ip}`, max: limits.perPerson[action], code: "limit_person" }];
  keys.push({ key: `rl:${day}:${action}:total`, max: limits.total[action], code: "limit_daily" });
  return keys;
}

/**
 * Counts one call of `action` and says whether it may go ahead: null when it may, otherwise
 * which limit was reached. The person's limit is checked first, so one person cannot use
 * up the shared daily allowance.
 */
export async function takeFromLimit(limiter: RateLimiter, action: LimitedAction, request: Request): Promise<LimitCode | null> {
  for (const { key, max, code } of limitKeys(limiter, action, request)) {
    if ((await limiter.counter.increment(key)) > max) return code;
  }
  return null;
}

/**
 * Returns a call taken by takeFromLimit, for a call that failed before Claude wrote anything
 * (credit used up, overloaded API): the person should not lose an attempt to our outage.
 * Called only after takeFromLimit let the call through, so both counters were raised.
 */
export async function giveBackToLimit(limiter: RateLimiter, action: LimitedAction, request: Request): Promise<void> {
  if (!limiter.counter.decrement) return;
  for (const { key } of limitKeys(limiter, action, request)) await limiter.counter.decrement(key);
}
