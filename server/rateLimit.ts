import { createHmac } from "node:crypto";
import { upstashTransaction } from "./upstash.js";

/**
 * Daily limits for the web build (docs/PRODUCTION.md, section 3, point 6). Every call to
 * Claude costs the author money, so the server counts calls per person and in total and
 * refuses once a limit is reached. The numbers live here and nowhere else.
 */
export const dailyLimits = {
  // Per person: two full attempts (25 messages each), two evaluations, a few feedback notes.
  perPerson: { chat: 50, evaluate: 2, feedback: 5 },
  // For everyone together: a ceiling on what one day can cost (and on feedback spam).
  total: { chat: 150, evaluate: 5, feedback: 100 },
};

export type LimitedAction = keyof typeof dailyLimits.perPerson;
export type LimitCode = "limit_person" | "limit_daily";

/** Adds one to a counter and returns the new value. Counters are dropped after two days. */
export type Counter = { increment(key: string): Promise<number> };

export type RateLimiter = {
  counter: Counter;
  // Secret mixed into the person id, so stored ids cannot be turned back into IP addresses.
  secret: string;
  limits?: typeof dailyLimits;
  now?: () => Date;
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
  };
}

// The day as people in Czechia see it, so "try again tomorrow" means after local midnight.
function pragueDay(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Prague" }).format(date);
}

// The person behind a request, as a short keyed hash of their IP address. Vercel sets
// x-real-ip and x-forwarded-for itself; locally there is none and everyone is "unknown".
function personId(request: Request, secret: string): string {
  const ip =
    request.headers.get("x-real-ip")?.trim() || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  return createHmac("sha256", secret).update(ip).digest("hex").slice(0, 16);
}

/**
 * Counts one call of `action` and says whether it may go ahead: null when it may, otherwise
 * which limit was reached. The person's limit is checked first, so one person cannot use
 * up the shared daily allowance.
 */
export async function takeFromLimit(limiter: RateLimiter, action: LimitedAction, request: Request): Promise<LimitCode | null> {
  const limits = limiter.limits ?? dailyLimits;
  const day = pragueDay((limiter.now ?? (() => new Date()))());

  const personCount = await limiter.counter.increment(`rl:${day}:${action}:person:${personId(request, limiter.secret)}`);
  if (personCount > limits.perPerson[action]) return "limit_person";

  const totalCount = await limiter.counter.increment(`rl:${day}:${action}:total`);
  if (totalCount > limits.total[action]) return "limit_daily";
  return null;
}
