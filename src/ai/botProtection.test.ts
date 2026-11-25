import { describe, expect, it, vi } from "vitest";
import { readdirSync } from "node:fs";
import { installBotProtection, protectedPaths } from "./botProtection";

const origin = "https://role-lab.example";
type Fetch = typeof fetch;

// A stand-in for BotID's fetch wrapper: gets a signature (or not), adds its header, then calls
// the fetch beneath it with copied options, as the real one does.
function fakeBotId(getSignature: () => Promise<string>) {
  return (target: { fetch: Fetch }) => () => {
    const beneath = target.fetch;
    target.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const signature = await getSignature();
      return beneath(input, { ...init, headers: { "x-is-human": signature } });
    }) as Fetch;
  };
}

function setUp(getSignature: () => Promise<string>, waitMs = 50) {
  const sent: { url: string; headers: unknown }[] = [];
  const target = {
    fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
      sent.push({ url: String(input), headers: init?.headers });
      if (init?.signal?.aborted) throw new DOMException("aborted", "AbortError");
      return new Response("ok");
    }) as Fetch,
  };
  installBotProtection(target, fakeBotId(getSignature)(target), origin, waitMs);
  return { target, sent };
}

const post = { method: "POST", body: "{}" };
const later = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("installBotProtection", () => {
  it("sends a protected request once, with BotID's header", async () => {
    const { target, sent } = setUp(async () => "signed");
    await target.fetch("/api/chat", post);
    expect(sent).toEqual([{ url: "/api/chat", headers: { "x-is-human": "signed" } }]);
  });

  it("sends it once without the header when BotID's script fails", async () => {
    const { target, sent } = setUp(() => Promise.reject(new Error("blocked by an ad blocker")));
    const response = await target.fetch("/api/chat", post);
    expect(await response.text()).toBe("ok");
    expect(sent).toEqual([{ url: "/api/chat", headers: undefined }]);
  });

  it("does not wait forever for a script that never answers, and never sends twice", async () => {
    let answer: (value: string) => void = () => {};
    const { target, sent } = setUp(() => new Promise((resolve) => (answer = resolve)));
    await target.fetch("/api/evaluate", post);
    expect(sent).toHaveLength(1);
    // BotID answers after all: the request must not go out a second time.
    answer("late");
    await later(20);
    expect(sent).toHaveLength(1);
  });

  it("stops waiting for BotID after it failed once", async () => {
    const getSignature = vi.fn(() => new Promise<string>(() => {}));
    const { target, sent } = setUp(getSignature);
    await target.fetch("/api/chat", post);
    const startedAt = Date.now();
    await target.fetch("/api/chat", post);
    expect(Date.now() - startedAt).toBeLessThan(40);
    expect(getSignature).toHaveBeenCalledTimes(1);
    expect(sent).toHaveLength(2);
  });

  it("keeps using BotID after a request was only cancelled", async () => {
    const getSignature = vi.fn(async () => {
      await later(20);
      return "signed";
    });
    const { target, sent } = setUp(getSignature, 10_000);
    const controller = new AbortController();
    const cancelled = target.fetch("/api/chat", { ...post, signal: controller.signal });
    controller.abort();
    await expect(cancelled).rejects.toThrow("aborted");
    await target.fetch("/api/chat", post);
    expect(sent.at(-1)?.headers).toEqual({ "x-is-human": "signed" });
  });

  it("does not wait for the timer when the request is cancelled", async () => {
    const { target } = setUp(() => new Promise(() => {}), 10_000);
    const controller = new AbortController();
    const request = target.fetch("/api/chat", { ...post, signal: controller.signal });
    controller.abort();
    await expect(request).rejects.toThrow("aborted");
  });

  it("treats BotID calling fetch again with its own options as the same request", async () => {
    const sent: string[] = [];
    const target = {
      fetch: (async (input: RequestInfo | URL) => {
        sent.push(String(input));
        return new Response("ok");
      }) as Fetch,
    };
    installBotProtection(
      target,
      () => {
        const beneath = target.fetch;
        let first = true;
        // Like BotID's deep analysis: the first call goes back through the page's fetch.
        target.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
          if (first) {
            first = false;
            return target.fetch(input, { ...init });
          }
          return beneath(input, init);
        }) as Fetch;
      },
      origin,
      50,
    );
    // The page's fetch replaced BotID's above, so call through the final one.
    await target.fetch("/api/chat", post);
    await later(80);
    expect(sent).toEqual(["/api/chat"]);
  });

  it("does not send twice when BotID's deeper check finishes after the request went without it", async () => {
    const sent: string[] = [];
    const target = {
      fetch: (async (input: RequestInfo | URL) => {
        sent.push(String(input));
        return new Response("ok");
      }) as Fetch,
    };
    installBotProtection(
      target,
      () => {
        const beneath = target.fetch;
        let isLoaded = false;
        // Like BotID's deep analysis: loads another script, then goes back through the page's fetch.
        target.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
          if (isLoaded) return beneath(input, init);
          await later(100);
          isLoaded = true;
          return target.fetch(input, { ...init });
        }) as Fetch;
      },
      origin,
      30,
    );
    await target.fetch("/api/chat", post);
    await later(150);
    expect(sent).toEqual(["/api/chat"]);
  });

  it("does not wait for a request that was cancelled before it started", async () => {
    const getSignature = vi.fn(async () => "signed");
    const { target, sent } = setUp(getSignature, 10_000);
    const startedAt = Date.now();
    await expect(target.fetch("/api/chat", { ...post, signal: AbortSignal.abort() })).rejects.toThrow("aborted");
    expect(Date.now() - startedAt).toBeLessThan(100);
    // It did not ask BotID, so a BotID that never answers could not hold it up either.
    expect(getSignature).not.toHaveBeenCalled();
    // BotID stays on for the next request.
    await target.fetch("/api/chat", post);
    expect(sent.at(-1)?.headers).toEqual({ "x-is-human": "signed" });
  });

  it("leaves other requests alone", async () => {
    const getSignature = vi.fn(async () => "signed");
    const { target, sent } = setUp(getSignature);
    await target.fetch("/api/admin", post);
    await target.fetch("/api/chat", { method: "GET" });
    await target.fetch("https://elsewhere.example/api/chat", post);
    expect(getSignature).not.toHaveBeenCalled();
    expect(sent).toHaveLength(3);
  });
});

describe("protectedPaths", () => {
  it("matches the endpoints the server checks", () => {
    const apiFolder = new URL("../../api/", import.meta.url);
    const endpoints = readdirSync(apiFolder)
      .filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts") && !["admin.ts", "cron-morning.ts", "stats.ts"].includes(file))
      .map((file) => `/api/${file.replace(/\.ts$/, "")}`);
    expect([...protectedPaths].sort()).toEqual(endpoints.sort());
  });
});
