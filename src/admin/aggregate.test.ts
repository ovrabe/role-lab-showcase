import { describe, expect, it } from "vitest";
import { activeTasks, endpointStats, group, latencyPercentile, modelStats, series, spendOfDay, sumDays, taskStats, type DayMetrics } from "./aggregate";

const days: DayMetrics[] = [
  { day: "2026-11-23", visitors: 3, metrics: { "screen.home": 3, "call.chat.ok": 2, "latency.chat.le2": 1, "latency.chat.le5": 1, "latency.chat.total_ms": 5000, "spend.chat.claude-sonnet-5-5": 1_500_000 } },
  { day: "2026-11-22", visitors: 1, metrics: { "screen.home": 1, "call.chat.error": 1, "error.chat.overloaded": 1, "latency.chat.le40": 1, "latency.chat.total_ms": 30000 } },
];

describe("admin aggregation", () => {
  it("adds days and groups by prefix", () => {
    const total = sumDays(days);
    expect(total["screen.home"]).toBe(4);
    expect(group(total, "screen.")).toEqual({ home: 4 });
    expect(series(days, (day) => day.visitors)).toEqual([{ day: "2026-11-22", value: 1 }, { day: "2026-11-23", value: 3 }]);
    expect(spendOfDay(days[0].metrics)).toBe(1.5);
  });

  it("estimates the median and the slow tail from buckets", () => {
    expect(latencyPercentile({ le2: 5, le5: 4, le40: 1 }, 0.5)).toBe("≤ 2 s");
    expect(latencyPercentile({ le2: 5, le5: 4, le40: 1 }, 0.9)).toBe("≤ 5 s");
    expect(latencyPercentile({}, 0.5)).toBeNull();
  });

  it("summarises endpoints with errors and average time", () => {
    const [chat] = endpointStats(sumDays(days));
    expect(chat).toMatchObject({ endpoint: "chat", calls: 3, errors: 1, averageSeconds: 11.7, errorCodes: { overloaded: 1 } });
  });

  it("summarises models with tokens and dollars", () => {
    const rows = modelStats({ "model.evaluate.claude-opus-5-5.calls": 2, "model.evaluate.claude-opus-5-5.input_tokens": 40000, "model.evaluate.claude-opus-5-5.output_tokens": 6000, "spend.evaluate.claude-opus-5-5": 280000 });
    expect(rows).toEqual([{ endpoint: "evaluate", model: "claude-opus-5-5", calls: 2, inputTokens: 40000, outputTokens: 6000, usd: 0.28 }]);
  });

  it("summarises a task: funnel, levels, scores and traps", () => {
    const stats = taskStats(
      {
        "funnel.qa.started": 5, "funnel.qa.first_message": 4, "funnel.qa.submitted": 3, "funnel.qa.evaluated": 2,
        "outcome.qa.count": 2, "outcome.qa.level.1": 1, "outcome.qa.level.3": 1, "outcome.qa.score.verification": 5,
        "outcome.qa.trap.T1_x.caught": 1, "outcome.qa.trap.T1_x.missed": 1, "outcome.qa.minutes": 30, "outcome.qa.messages": 10,
      },
      "qa",
    );
    expect(stats).toMatchObject({ started: 5, firstMessage: 4, submitted: 3, evaluated: 2, averageLevel: 2, averageScores: { verification: 2.5 }, averageMinutes: 15, averageMessages: 5 });
    expect(stats.traps).toEqual({ T1_x: { caught: 1, partial: 0, missed: 1 } });
    expect(taskStats({}, "nic")).toMatchObject({ averageLevel: null, averageMinutes: null });
  });

  it("lists active tasks, most active first", () => {
    expect(activeTasks({ "funnel.a.started": 1, "funnel.b.started": 3, "outcome.b.count": 1, "screen.home": 9 })).toEqual(["b", "a"]);
  });
});
