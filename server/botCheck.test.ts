import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { botNameKey, logBotVerdict, type BotIdCheck } from "./botCheck";
import { memoryMetrics, pragueDay } from "./metrics";

const verdictOf = (result: { isHuman: boolean; isBot: boolean; isVerifiedBot: boolean }): BotIdCheck => async () => result;

async function run(check: BotIdCheck, onVercel = true) {
  const lines: string[] = [];
  const verdict = await logBotVerdict("chat", { check, onVercel, log: (line) => lines.push(line) });
  return { verdict, lines };
}

describe("logBotVerdict", () => {
  it("logs a person, a bot and a known good bot", async () => {
    expect((await run(verdictOf({ isHuman: true, isBot: false, isVerifiedBot: false }))).verdict).toBe("human");
    expect((await run(verdictOf({ isHuman: false, isBot: true, isVerifiedBot: false }))).verdict).toBe("bot");
    expect((await run(verdictOf({ isHuman: false, isBot: true, isVerifiedBot: true }))).verdict).toBe("verified-bot");
    const { lines } = await run(verdictOf({ isHuman: false, isBot: true, isVerifiedBot: false }));
    expect(JSON.parse(lines[0])).toMatchObject({ botid: "bot", route: "chat" });
  });

  it("says when BotID skipped the check and only claimed a person", async () => {
    const { lines } = await run(async () => ({ isHuman: true, isBot: false, isVerifiedBot: false, bypassed: true }));
    expect(JSON.parse(lines[0])).toMatchObject({ botid: "human", skipped: true });
  });

  it("counts each verdict in the daily metrics, without the route", async () => {
    const metrics = memoryMetrics();
    const human = async () => ({ isHuman: true, isBot: false, isVerifiedBot: false });
    await logBotVerdict("chat", { check: human, onVercel: true, log: () => {}, metrics });
    await logBotVerdict("feedback", { check: human, onVercel: true, log: () => {}, metrics });
    await logBotVerdict("chat", { check: async () => ({ isHuman: true, isBot: false, isVerifiedBot: false, bypassed: true }), onVercel: true, log: () => {}, metrics });
    await logBotVerdict("why", { check: async () => { throw new Error("down"); }, onVercel: true, log: () => {}, metrics });
    expect(await metrics.readDay(pragueDay(new Date()))).toEqual({ "botid.human": 3, "botid.skipped": 1, "botid.unknown": 1, "botid.problem": 1 });
  });

  it("counts known good bots by name, as a safe short key", async () => {
    const metrics = memoryMetrics();
    const known = (name?: string) => async () => ({ isHuman: false, isBot: true, isVerifiedBot: true, verifiedBotName: name });
    await logBotVerdict("chat", { check: known("Googlebot"), onVercel: true, log: () => {}, metrics });
    await logBotVerdict("chat", { check: known("Googlebot"), onVercel: true, log: () => {}, metrics });
    await logBotVerdict("chat", { check: known(undefined), onVercel: true, log: () => {}, metrics });
    expect(await metrics.readDay(pragueDay(new Date()))).toEqual({ "botid.verified-bot": 3, "botid.known.googlebot": 2, "botid.known.unnamed": 1 });
    expect(botNameKey("Bing Preview / 2.0")).toBe("bing-preview-2-0");
    expect(botNameKey("x".repeat(500))).toHaveLength(40);
    expect(botNameKey("$$$")).toBe("unnamed");
  });

  it("counts nothing outside Vercel", async () => {
    const metrics = memoryMetrics();
    await logBotVerdict("chat", { onVercel: false, metrics });
    expect(metrics.days.size).toBe(0);
  });

  it("does not ask anyone outside Vercel", async () => {
    let asked = false;
    const { verdict, lines } = await run(async () => {
      asked = true;
      return { isHuman: true, isBot: false, isVerifiedBot: false };
    }, false);
    expect(verdict).toBe("unknown");
    expect(asked).toBe(false);
    expect(lines).toEqual([]);
  });

  it("lets the request go on when BotID fails, with only the first line of the error", async () => {
    const { verdict, lines } = await run(async () => {
      throw new Error("The 'x-vercel-oidc-token' header is missing\n    at stack line");
    });
    expect(verdict).toBe("unknown");
    expect(JSON.parse(lines[0]).problem).toBe("The 'x-vercel-oidc-token' header is missing");
  });

  it("does not wait for a slow BotID longer than a moment", async () => {
    const startedAt = Date.now();
    const { verdict, lines } = await run(() => new Promise(() => {}));
    expect(verdict).toBe("unknown");
    expect(JSON.parse(lines[0]).problem).toBe("timeout");
    expect(Date.now() - startedAt).toBeLessThan(2500);
  });

  it("never logs the address or the headers", async () => {
    const { lines } = await run(verdictOf({ isHuman: true, isBot: false, isVerifiedBot: false }));
    expect(Object.keys(JSON.parse(lines[0])).sort()).toEqual(["botid", "ms", "route"]);
  });
});

describe("endpoints", () => {
  // The admin page has its own token and the cron its secret; the statistics are sent as a tab
  // closes and cost nothing (src/ai/botProtection.ts). Everything else people can call.
  const unchecked = ["admin.ts", "cron-morning.ts", "stats.ts"];
  // Next to this file, not where the test was started from (it may run from another folder).
  const apiFolder = new URL("../api/", import.meta.url);
  const files = readdirSync(apiFolder).filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts"));

  it.each(files.filter((file) => !unchecked.includes(file)))("%s logs a BotID verdict under its own name", (file) => {
    const source = readFileSync(new URL(file, apiFolder), "utf8");
    expect(source).toContain(`await logBotVerdict("${file.replace(/\.ts$/, "")}", { metrics: deps.limiter.metrics })`);
  });
});
