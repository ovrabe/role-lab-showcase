import { endpointStats, sumDays, type DayMetrics, type MetricEntries } from "./aggregate.js";

/**
 * The headline numbers of one period: what the admin overview shows as big numbers and
 * trends, and the only data the AI summary is written from (docs/PROMPTS.md, section 7).
 * Totals only, nothing a person wrote. Shared by the page and the server.
 */
export type Digest = {
  days: number;
  visitors: number;
  funnel: { started: number; firstMessage: number; submitted: number; evaluated: number };
  averageLevel: number | null;
  skills: Record<string, number>;
  trapsFoundShare: number | null;
  spendUsd: number;
  tourCompleted: number;
  customTasksGenerated: number;
  pageErrors: number;
  endpoints: { endpoint: string; calls: number; errors: number; median: string | null }[];
};

const dimensions = ["framing", "decomposition", "verification", "iteration", "judgment"];
const round1 = (value: number) => Math.round(value * 10) / 10;

function sumMatching(total: MetricEntries, pattern: RegExp): number {
  return Object.entries(total).reduce((sum, [name, value]) => (pattern.test(name) ? sum + value : sum), 0);
}

export function digest(days: DayMetrics[]): Digest {
  const total = sumDays(days);
  const evaluated = sumMatching(total, /^outcome\.[^.]+\.count$/);
  const levelSum = Object.entries(total).reduce((sum, [name, value]) => {
    const match = name.match(/^outcome\.[^.]+\.level\.(\d)$/);
    return match ? sum + Number(match[1]) * value : sum;
  }, 0);
  const caught = sumMatching(total, /^outcome\.[^.]+\.trap\..+\.caught$/);
  const allTraps = sumMatching(total, /^outcome\.[^.]+\.trap\..+\.(caught|partial|missed)$/);
  const skills: Record<string, number> = {};
  if (evaluated > 0) for (const dimension of dimensions) skills[dimension] = round1(sumMatching(total, new RegExp(`^outcome\\.[^.]+\\.score\\.${dimension}$`)) / evaluated);
  return {
    days: days.length,
    visitors: days.reduce((sum, day) => sum + day.visitors, 0),
    funnel: {
      started: sumMatching(total, /^funnel\.[^.]+\.started$/),
      firstMessage: sumMatching(total, /^funnel\.[^.]+\.first_message$/),
      submitted: sumMatching(total, /^funnel\.[^.]+\.submitted$/),
      evaluated,
    },
    averageLevel: evaluated > 0 ? round1(levelSum / evaluated) : null,
    skills,
    trapsFoundShare: allTraps > 0 ? Math.round((caught / allTraps) * 100) / 100 : null,
    // What the testers' use costs; the author's admin calls have their own lines in "Modely a útrata".
    spendUsd: Math.round((sumMatching(total, /^spend\.(?!admin)/) / 1_000_000) * 100) / 100,
    tourCompleted: total["tour.completed"] ?? 0,
    customTasksGenerated: total["call.customTask.ok"] ?? 0,
    pageErrors: (total["client_error.render"] ?? 0) + (total["client_error.script"] ?? 0),
    // The testers' calls only; the author's admin calls are not part of how the app runs for them.
    endpoints: endpointStats(total).filter((row) => !row.endpoint.startsWith("admin")).map(({ endpoint, calls, errors, median }) => ({ endpoint, calls, errors, median })),
  };
}

/** Change against the previous period as a whole percent, or null when there is nothing to compare. */
export function change(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}
