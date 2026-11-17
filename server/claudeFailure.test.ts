import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import { handleClaudeFailure } from "./claudeFailure";
import { toClaudeError } from "./claudeClient";
import { memoryCounter, takeFromLimit, type RateLimiter } from "./rateLimit";
import { memoryIssueTracker } from "./issues";
import { handleSampleError } from "../src/assistant/sampleErrors";

const limits = { perPerson: { chat: 1, evaluate: 1, feedback: 1, challenge: 1 }, total: { chat: 5, evaluate: 5, feedback: 5, challenge: 5 } };
const now = () => new Date("2026-11-17T10:00:00Z");
const limiter = (): RateLimiter => ({ counter: memoryCounter(), secret: "test", limits, now });
const request = () => new Request("https://role-lab.test/api/evaluate", { method: "POST", headers: { "x-real-ip": "1.2.3.4" } });

describe("a call to Claude that fails", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});

  it("gives the attempt back when Claude wrote nothing, so the person can try again", async () => {
    const shared = limiter();
    expect(await takeFromLimit(shared, "evaluate", request())).toBeNull();
    expect(await takeFromLimit(shared, "evaluate", request())).toBe("limit_person");

    const fresh = limiter();
    await takeFromLimit(fresh, "evaluate", request());
    await handleClaudeFailure({ limiter: fresh }, "evaluate", request(), { code: "upstream_error", message: "529" }, now);
    expect(await takeFromLimit(fresh, "evaluate", request())).toBeNull();
  });

  it("keeps the attempt counted when part of the answer was written, the person cancelled, or Claude refused", async () => {
    for (const failure of [
      { code: "upstream_error", message: "cut", text: "Část odpovědi" },
      { code: "cancelled", message: "Aborted." },
      { code: "refused", message: "Claude declined." },
    ]) {
      const shared = limiter();
      await takeFromLimit(shared, "chat", request());
      await handleClaudeFailure({ limiter: shared }, "chat", request(), failure, now);
      expect(await takeFromLimit(shared, "chat", request())).toBe("limit_person");
    }
  });

  it("files one backlog issue a day when the API is unusable, however many calls fail", async () => {
    const shared = limiter();
    const issues = memoryIssueTracker();
    for (let i = 0; i < 3; i++) {
      await handleClaudeFailure({ limiter: shared, issues }, "chat", request(), { code: "ai_unavailable", message: "Anthropic credit balance too low." }, now);
    }
    expect(issues.issues).toHaveLength(1);
    expect(issues.issues[0].title).toContain("došel kredit");
    expect(issues.issues[0].body).toContain("Anthropic credit balance too low.");
    expect(issues.issues[0].labels).toEqual(["provoz"]);
  });

  it("files no issue for an ordinary outage", async () => {
    const issues = memoryIssueTracker();
    await handleClaudeFailure({ limiter: limiter(), issues }, "chat", request(), { code: "upstream_error", message: "529" }, now);
    expect(issues.issues).toHaveLength(0);
  });

  it("still answers the person when GitHub or the counter store is down", async () => {
    const broken: RateLimiter = { counter: { increment: () => Promise.reject(new Error("down")), decrement: () => Promise.reject(new Error("down")) }, secret: "t" };
    const issues = { create: () => Promise.reject(new Error("GitHub down")) };
    await expect(handleClaudeFailure({ limiter: broken, issues }, "chat", request(), { code: "ai_unavailable", message: "x" }, now)).resolves.toBeUndefined();
  });
});

describe("recognising that the API is unusable for everyone", () => {
  it("a used-up credit and a rejected key both become ai_unavailable", () => {
    const credit = new Anthropic.BadRequestError(
      400,
      { type: "error", error: { type: "invalid_request_error", message: "Your credit balance is too low to access the Anthropic API." } },
      "Your credit balance is too low to access the Anthropic API.",
      new Headers(),
    );
    expect(toClaudeError(credit).code).toBe("ai_unavailable");
    const key = new Anthropic.AuthenticationError(401, { type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } }, "invalid x-api-key", new Headers());
    expect(toClaudeError(key).code).toBe("ai_unavailable");
  });

  it("any other bad request stays an ordinary error", () => {
    const other = new Anthropic.BadRequestError(400, { type: "error", error: { type: "invalid_request_error", message: "max_tokens too large" } }, "max_tokens too large", new Headers());
    expect(toClaudeError(other).code).toBe("upstream_error");
  });

  it("the page explains it and offers no pointless retry", () => {
    const handling = handleSampleError({ code: "ai_unavailable" });
    expect(handling.offerRetry).toBe(false);
    expect(handling.message).toContain("dočasně nedostupná");
  });
});
