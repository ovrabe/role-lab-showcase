import { createHmac } from "node:crypto";
import type { MetricsStore } from "./metrics.js";
import type { Notifier } from "./notify.js";
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
  // Chat and evaluation were 150 and 5 until the dollar budget (spendBudget.ts) held the worst
  // case before each call; money is capped there now, so these only share the day out. Sized
  // for four colleagues on one office network (the author's decision, 25. 11. 2026): a third
  // of 600 and 24 is 200 messages and 8 evaluations, four people's full day.
  total: { chat: 600, evaluate: 24, feedback: 100, challenge: 300, example: 1000, stats: 20000, why: 300, customTask: 5, customTaskStatus: 3000, customTaskShare: 30 },
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
  // Slack notifications for the author (server/notify.ts); kept here for the same reason.
  notifier?: Notifier | null;
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
      // With its expiry too: a counter must never stay forever (a give-back after midnight used
      // to create the next day's key without one).
      await upstashTransaction(url, token, [
        ["DECR", key],
        ["EXPIRE", key, String(keyLifetimeSeconds)],
      ]);
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
// And never more than a third of the day's total: otherwise one address could use up a small
// total and nobody else could evaluate until midnight. A script now needs at
// least three addresses for that.
const maxIpShareOfTotal = 1 / 3;

/** How many calls one IP address may make today: a few people's worth, within its share of the total. */
export function ipCeiling(perPerson: number, total: number): number {
  return Math.max(perPerson, Math.min(perPerson * sharedNetworkPeople, Math.ceil(total * maxIpShareOfTotal)));
}
const browserIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const hashed = (value: string, secret: string) => createHmac("sha256", secret).update(value).digest("hex").slice(0, 16);
/**
 * The caller's address as the limits see it. Vercel sets x-real-ip and x-forwarded-for itself;
 * locally there is none ("unknown"). An IPv6 address counts by its /64 network: one home or
 * server gets a whole /64, so counting single addresses would give one machine billions of
 * "people". An IPv4 address written as IPv6 ("::ffff:1.2.3.4") counts as that IPv4 address.
 */
export function clientAddress(request: Request): string {
  const raw = request.headers.get("x-real-ip")?.trim() || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  // Written forms Vercel does not send but a header might hold: "[2001:db8::1]", "%eth0" zone,
  // "1.2.3.4:5678" with a port.
  const address = raw.replace(/^\[|\](:\d+)?$/g, "").replace(/%.*$/, "").replace(/^(\d+\.\d+\.\d+\.\d+):\d+$/, "$1");
  if (!address.includes(":")) return address;
  const mapped = address.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (mapped) return mapped[1];
  const [head, tail = ""] = address.toLowerCase().split("::");
  const front = head ? head.split(":") : [];
  const back = tail ? tail.split(":") : [];
  const missing = 8 - front.length - back.length;
  // Not a real IPv6 address (too many groups): counted as it is, never a crash.
  if (missing < 0 || (!address.includes("::") && front.length !== 8)) return address.toLowerCase();
  const groups = address.includes("::") ? [...front, ...Array(missing).fill("0"), ...back] : front;
  return `${groups.slice(0, 4).map((group) => group.replace(/^0+(?=.)/, "")).join(":")}::/64`;
}
const ipOf = clientAddress;
function browserOf(request: Request): string | null {
  const id = request.headers.get("x-role-lab-browser")?.trim() ?? "";
  return browserIdPattern.test(id) ? id : null;
}

// The day a request's attempt was counted on, so giving it back after midnight returns it to
// that day, not to the new one (which got a free call).
const countedDay = new WeakMap<Request, string>();

// The counters one call goes against, with their ceilings, in the order they are checked.
function limitKeys(limiter: RateLimiter, action: LimitedAction, request: Request) {
  const limits = limiter.limits ?? dailyLimits;
  const day = countedDay.get(request) ?? pragueDay((limiter.now ?? (() => new Date()))());
  const ip = hashed(ipOf(request), limiter.secret);
  const browser = browserOf(request);
  const keys: { key: string; max: number; code: LimitCode }[] = browser
    ? [
        { key: `rl:${day}:${action}:browser:${hashed(browser, limiter.secret)}`, max: limits.perPerson[action], code: "limit_person" },
        { key: `rl:${day}:${action}:person:${ip}`, max: ipCeiling(limits.perPerson[action], limits.total[action]), code: "limit_person" },
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
/**
 * Whether today's limit for `action` is already used up, without counting anything: checked
 * before the money is held, so a person who will be refused anyway never holds money (and many
 * such requests cannot pass for a busy moment, or set off the stuck-holds alert, for free).
 */
export async function limitAlreadyReached(limiter: RateLimiter, action: LimitedAction, request: Request): Promise<LimitCode | null> {
  if (!limiter.counter.add) return null;
  for (const { key, max, code } of limitKeys(limiter, action, request)) {
    if ((await limiter.counter.add(key, 0)) >= max) return code;
  }
  return null;
}

export async function takeFromLimit(limiter: RateLimiter, action: LimitedAction, request: Request): Promise<LimitCode | null> {
  countedDay.set(request, pragueDay((limiter.now ?? (() => new Date()))()));
  for (const { key, max, code } of limitKeys(limiter, action, request)) {
    if ((await limiter.counter.increment(key)) > max) return code;
  }
  return null;
}

/**
 * Returns a call taken by takeFromLimit: after an outage on our side (credit used up, overloaded
 * API), always; after answers that were paid for but unusable, once a day per address
 * (`afterPaidCalls`). Called only after takeFromLimit let the call through. True when it came back.
 */
export async function giveBackToLimit(
  limiter: RateLimiter,
  action: LimitedAction,
  request: Request,
  { afterPaidCalls = false }: { afterPaidCalls?: boolean } = {},
): Promise<boolean> {
  if (!limiter.counter.decrement) return false;
  // After calls that were paid for (the model answered, but unusably), once a day per person:
  // a description or submission made to break the model on purpose would otherwise make the
  // count limit endless. An outage costs nothing, so its attempts always come back.
  // Counted per address, not per browser: the browser id comes from the page, and a script
  // inventing a new one each time got every paid failure back (review of 24. 11. 2026).
  if (afterPaidCalls) {
    const keys = limitKeys(limiter, action, request);
    const addressKey = keys.find(({ key }) => key.includes(":person:")) ?? keys[0];
    if ((await limiter.counter.increment(`${addressKey.key}:given-back`)) > 1) return false;
  }
  for (const { key } of limitKeys(limiter, action, request)) await limiter.counter.decrement(key);
  return true;
}
