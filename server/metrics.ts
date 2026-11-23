import { upstashTransaction } from "./upstash.js";
import { costMicroUsd, type Usage } from "./spendBudget.js";

/**
 * Anonymous operating metrics for the admin page (docs/PRODUCTION.md, part 11): daily totals
 * only, kept 90 days. One Redis hash per day (`metrics:<day>`, field = metric name, value =
 * sum), so a day is one write transaction and one read. No texts, no identities, no IPs:
 * names are fixed by the code, values are counts, milliseconds or micro-dollars.
 */
export const metricsLifetimeSeconds = 90 * 24 * 60 * 60;

export type MetricEntries = Record<string, number>;

export type MetricsStore = {
  add(day: string, entries: MetricEntries): Promise<void>;
  // Unique visitors: a HyperLogLog per day keeps only an estimate of how many distinct
  // members were added, never the members themselves.
  addUnique(day: string, name: string, member: string): Promise<void>;
  readDay(day: string): Promise<MetricEntries>;
  countUnique(day: string, name: string): Promise<number>;
};

const hashKey = (day: string) => `metrics:${day}`;
const uniqueKey = (day: string, name: string) => `unique:${day}:${name}`;

/** In this process's memory: for local development and tests only. */
export function memoryMetrics(): MetricsStore & { days: Map<string, MetricEntries> } {
  const days = new Map<string, MetricEntries>();
  const uniques = new Map<string, Set<string>>();
  return {
    days,
    async add(day, entries) {
      const current = days.get(day) ?? {};
      for (const [name, amount] of Object.entries(entries)) current[name] = (current[name] ?? 0) + amount;
      days.set(day, current);
    },
    async addUnique(day, name, member) {
      const key = uniqueKey(day, name);
      uniques.set(key, (uniques.get(key) ?? new Set()).add(member));
    },
    async readDay(day) {
      return { ...(days.get(day) ?? {}) };
    },
    async countUnique(day, name) {
      return uniques.get(uniqueKey(day, name))?.size ?? 0;
    },
  };
}

export function upstashMetrics(url: string, token: string): MetricsStore {
  const lifetime = String(metricsLifetimeSeconds);
  return {
    async add(day, entries) {
      const fields = Object.entries(entries).filter(([, amount]) => amount !== 0);
      if (fields.length === 0) return;
      await upstashTransaction(url, token, [
        ...fields.map(([name, amount]) => ["HINCRBY", hashKey(day), name, String(Math.round(amount))]),
        ["EXPIRE", hashKey(day), lifetime],
      ]);
    },
    async addUnique(day, name, member) {
      await upstashTransaction(url, token, [
        ["PFADD", uniqueKey(day, name), member],
        ["EXPIRE", uniqueKey(day, name), lifetime],
      ]);
    },
    async readDay(day) {
      const [flat] = await upstashTransaction(url, token, [["HGETALL", hashKey(day)]]);
      const entries: MetricEntries = {};
      const list = (flat ?? []) as string[];
      for (let index = 0; index + 1 < list.length; index += 2) entries[list[index]] = Number(list[index + 1]);
      return entries;
    },
    async countUnique(day, name) {
      const [count] = await upstashTransaction(url, token, [["PFCOUNT", uniqueKey(day, name)]]);
      return Number(count ?? 0);
    },
  };
}

export const pragueDay = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Prague" }).format(date);

/** Adds metrics for today. Never fails the request: statistics are a convenience. */
export async function addMetrics(metrics: MetricsStore | null | undefined, entries: MetricEntries, now = new Date()): Promise<void> {
  if (!metrics) return;
  try {
    await metrics.add(pragueDay(now), entries);
  } catch (error) {
    console.error("Metrics failed:", error);
  }
}

// Latency in buckets (upper bounds in seconds), so the admin can show the median and the slow tail.
export const latencyBuckets = [2, 5, 10, 20, 40, 80, 160, 300] as const;
export const latencyBucket = (milliseconds: number) => `le${latencyBuckets.find((limit) => milliseconds <= limit * 1000) ?? "max"}`;

/**
 * Measures one call of a model for an endpoint: how long it took, how it ended, which model
 * answered, tokens and cost. Collects the numbers and writes them once, in finish().
 */
export function measureCall(metrics: MetricsStore | null | undefined, endpoint: string) {
  const started = Date.now();
  const entries: MetricEntries = {};
  const bump = (name: string, amount = 1) => (entries[name] = (entries[name] ?? 0) + amount);
  return {
    usage(model: string, usage: Usage) {
      bump(`model.${endpoint}.${model}.calls`);
      bump(`model.${endpoint}.${model}.input_tokens`, usage.input_tokens + (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0));
      bump(`model.${endpoint}.${model}.output_tokens`, usage.output_tokens);
      bump(`spend.${endpoint}.${model}`, costMicroUsd(model, usage));
    },
    add: bump,
    /** outcome: "ok" or an error code such as upstream_error, invalid_json, truncated. */
    async finish(outcome: string) {
      const elapsed = Date.now() - started;
      bump(`call.${endpoint}.${outcome === "ok" ? "ok" : "error"}`);
      if (outcome !== "ok") bump(`error.${endpoint}.${outcome}`);
      bump(`latency.${endpoint}.${latencyBucket(elapsed)}`);
      bump(`latency.${endpoint}.total_ms`, elapsed);
      await addMetrics(metrics, entries);
    },
  };
}
