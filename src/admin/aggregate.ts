// Turns the daily metrics of /api/admin (server/metrics.ts) into what the admin page shows.
// Pure functions over plain numbers, so they are easy to test and need no server.

export type MetricEntries = Record<string, number>;
export type DayMetrics = { day: string; metrics: MetricEntries; visitors: number };

/** All days added together. */
export function sumDays(days: DayMetrics[]): MetricEntries {
  const total: MetricEntries = {};
  for (const { metrics } of days) for (const [name, value] of Object.entries(metrics)) total[name] = (total[name] ?? 0) + value;
  return total;
}

/** The metrics under a prefix, keyed by the rest of the name: group(total, "screen.") → { home: 4 }. */
export function group(total: MetricEntries, prefix: string): MetricEntries {
  const result: MetricEntries = {};
  for (const [name, value] of Object.entries(total)) if (name.startsWith(prefix)) result[name.slice(prefix.length)] = value;
  return result;
}

/** A series per day, oldest first, for a chart. */
export function series(days: DayMetrics[], pick: (day: DayMetrics) => number): { day: string; value: number }[] {
  return [...days].reverse().map((day) => ({ day: day.day, value: pick(day) }));
}

const sumWhere = (metrics: MetricEntries, test: (name: string) => boolean) =>
  Object.entries(metrics).reduce((sum, [name, value]) => (test(name) ? sum + value : sum), 0);

/** Dollars spent on one day (the metrics hold micro-dollars). */
export const spendOfDay = (metrics: MetricEntries) => sumWhere(metrics, (name) => name.startsWith("spend.")) / 1_000_000;

/** Calls and errors of one day, over all endpoints. */
export const callsOfDay = (metrics: MetricEntries) => sumWhere(metrics, (name) => /^call\.[^.]+\.(ok|error)$/.test(name));
export const errorsOfDay = (metrics: MetricEntries) => sumWhere(metrics, (name) => /^call\.[^.]+\.error$/.test(name));

// The latency buckets of server/metrics.ts, in seconds.
const latencyLimits = [2, 5, 10, 20, 40, 80, 160, 300];

/** The bucket that holds the given share of calls, as "≤ 10 s". Null without calls. */
export function latencyPercentile(buckets: MetricEntries, share: number): string | null {
  const counts = latencyLimits.map((limit) => buckets[`le${limit}`] ?? 0);
  const over = buckets.lemax ?? 0;
  const total = counts.reduce((sum, value) => sum + value, over);
  if (total === 0) return null;
  let seen = 0;
  for (const [index, count] of counts.entries()) {
    seen += count;
    if (seen >= share * total) return `≤ ${latencyLimits[index]} s`;
  }
  return "> 300 s";
}

export type EndpointStats = { endpoint: string; calls: number; errors: number; averageSeconds: number | null; median: string | null; p90: string | null; errorCodes: MetricEntries };

/** Per endpoint: calls, errors with their codes, average time and the median and slow tail. */
export function endpointStats(total: MetricEntries): EndpointStats[] {
  const endpoints = new Set(Object.keys(total).flatMap((name) => (name.startsWith("call.") ? [name.split(".")[1]] : [])));
  return [...endpoints].sort().map((endpoint) => {
    const calls = (total[`call.${endpoint}.ok`] ?? 0) + (total[`call.${endpoint}.error`] ?? 0);
    const latency = group(total, `latency.${endpoint}.`);
    return {
      endpoint,
      calls,
      errors: total[`call.${endpoint}.error`] ?? 0,
      averageSeconds: calls > 0 ? Math.round((latency.total_ms ?? 0) / calls / 100) / 10 : null,
      median: latencyPercentile(latency, 0.5),
      p90: latencyPercentile(latency, 0.9),
      errorCodes: group(total, `error.${endpoint}.`),
    };
  });
}

export type ModelStats = { endpoint: string; model: string; calls: number; inputTokens: number; outputTokens: number; usd: number };

/** Per endpoint and model: calls, tokens and dollars. */
export function modelStats(total: MetricEntries): ModelStats[] {
  const rows = new Map<string, ModelStats>();
  for (const [name, value] of Object.entries(total)) {
    const match = name.match(/^model\.([^.]+)\.(.+)\.(calls|input_tokens|output_tokens)$/);
    if (!match) continue;
    const [, endpoint, model, field] = match;
    const key = `${endpoint}|${model}`;
    const row = rows.get(key) ?? { endpoint, model, calls: 0, inputTokens: 0, outputTokens: 0, usd: (total[`spend.${endpoint}.${model}`] ?? 0) / 1_000_000 };
    if (field === "calls") row.calls += value;
    else if (field === "input_tokens") row.inputTokens += value;
    else row.outputTokens += value;
    rows.set(key, row);
  }
  return [...rows.values()].sort((a, b) => b.usd - a.usd);
}

export type TaskStats = {
  task: string;
  started: number;
  firstMessage: number;
  submitted: number;
  evaluated: number;
  levels: Record<string, number>;
  averageLevel: number | null;
  averageScores: Record<string, number>;
  traps: Record<string, { caught: number; partial: number; missed: number }>;
  averageMinutes: number | null;
  averageMessages: number | null;
  flagged: number;
};

/** Per task: how far people get and how the evaluations turn out. */
export function taskStats(total: MetricEntries, task: string): TaskStats {
  const funnel = group(total, `funnel.${task}.`);
  const outcome = group(total, `outcome.${task}.`);
  const count = outcome.count ?? 0;
  const levels = Object.fromEntries(Object.entries(outcome).filter(([name]) => /^level\.\d$/.test(name)).map(([name, value]) => [name.slice(6), value]));
  const levelSum = Object.entries(levels).reduce((sum, [level, value]) => sum + Number(level) * value, 0);
  const averageScores = Object.fromEntries(
    Object.entries(outcome).filter(([name]) => name.startsWith("score.")).map(([name, value]) => [name.slice(6), count > 0 ? Math.round((value / count) * 10) / 10 : 0]),
  );
  const traps: TaskStats["traps"] = {};
  for (const [name, value] of Object.entries(outcome)) {
    const match = name.match(/^trap\.(.+)\.(caught|partial|missed)$/);
    if (!match) continue;
    traps[match[1]] ??= { caught: 0, partial: 0, missed: 0 };
    traps[match[1]][match[2] as "caught" | "partial" | "missed"] += value;
  }
  const average = (sum: number | undefined) => (count > 0 && sum !== undefined ? Math.round((sum / count) * 10) / 10 : null);
  return {
    task,
    started: funnel.started ?? 0,
    firstMessage: funnel.first_message ?? 0,
    submitted: funnel.submitted ?? 0,
    evaluated: Math.max(funnel.evaluated ?? 0, count),
    levels,
    averageLevel: count > 0 ? Math.round((levelSum / count) * 10) / 10 : null,
    averageScores,
    traps,
    averageMinutes: average(outcome.minutes),
    averageMessages: average(outcome.messages),
    flagged: outcome.flagged_for_review ?? 0,
  };
}

/** Task ids that have any activity, most active first. */
export function activeTasks(total: MetricEntries): string[] {
  const activity = new Map<string, number>();
  for (const [name, value] of Object.entries(total)) {
    const match = name.match(/^(funnel|outcome)\.([^.]+)\./);
    if (match) activity.set(match[2], (activity.get(match[2]) ?? 0) + value);
  }
  return [...activity.entries()].sort((a, b) => b[1] - a[1]).map(([task]) => task);
}
