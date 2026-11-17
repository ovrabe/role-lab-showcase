import { describe, expect, it } from "vitest";
import { handleChallenge, type ChallengeResponse } from "./challengeHandler";
import { loadServerContent } from "./content";
import type { ClaudeClient } from "./claudeClient";
import { memoryCounter } from "./rateLimit";
import { mockChallengeReply } from "../src/challenges/mockChallengeReply";

// Needs the challenge keys, so the public copy of the code skips it (vite.config.ts).
const content = loadServerContent();
const challenge = content.challenges.challenges[0];
const answer = "Přepočítám součet za celou firmu a porovnám změny s exportem, Ostrava podle mě klesla.";

function fakeClaude(reply?: string) {
  const sent: { prompt?: string } = {};
  const claude: ClaudeClient = {
    chat: async () => ({ truncated: false }),
    evaluate: async () => "",
    async evaluateChallenge(prompt) {
      sent.prompt = prompt;
      return reply ?? JSON.stringify(mockChallengeReply(prompt));
    },
  };
  return { claude, sent };
}

const deps = (claude: ClaudeClient, limits?: { perPerson: number }) => ({
  content,
  claude,
  limiter: {
    counter: memoryCounter(),
    secret: "test",
    ...(limits
      ? {
          limits: {
            perPerson: { chat: 1, evaluate: 1, feedback: 1, challenge: limits.perPerson, example: 1, stats: 1 },
            total: { chat: 1, evaluate: 1, feedback: 1, challenge: 99, example: 1, stats: 1 },
          },
        }
      : {}),
  },
});

const post = (body: unknown) =>
  new Request("http://localhost/api/challenge", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", origin: "http://localhost" },
  });

describe("POST /api/challenge", () => {
  it("evaluates an answer and reveals the traps only in the result", async () => {
    const { claude, sent } = fakeClaude();
    const response = await handleChallenge(post({ challengeId: challenge.id, answer }), deps(claude));
    const body = (await response.json()) as ChallengeResponse;
    expect(body.kind).toBe("ok");
    if (body.kind !== "ok") return;
    expect(body.result.traps.length).toBe(content.getChallengeKey(challenge.id)!.traps.length);
    expect(body.result.traps[0].whatIsWrong.length).toBeGreaterThan(0);
    // The server, not the browser, added the key to the prompt.
    expect(sent.prompt).toContain("<klic>");
    expect(sent.prompt).toContain(answer);
  });

  it.each([
    ["an answer that is too short", { challengeId: "verify-quarterly-sales", answer: "ok" }],
    ["an answer that is too long", { challengeId: "verify-quarterly-sales", answer: "a".repeat(5000) }],
    ["a missing answer", { challengeId: "verify-quarterly-sales" }],
    ["an empty body", {}],
  ])("refuses %s without calling Claude", async (_label, body) => {
    const { claude, sent } = fakeClaude();
    const response = await handleChallenge(post(body), deps(claude));
    expect(response.status).toBe(400);
    expect(sent.prompt).toBeUndefined();
  });

  it("refuses an unknown challenge", async () => {
    const response = await handleChallenge(post({ challengeId: "nope", answer }), deps(fakeClaude().claude));
    expect(response.status).toBe(400);
  });

  it("reports an unreadable reply as invalid, not as a crash", async () => {
    const response = await handleChallenge(post({ challengeId: challenge.id, answer }), deps(fakeClaude("tohle není JSON").claude));
    expect(((await response.json()) as ChallengeResponse).kind).toBe("invalid");
  });

  it("stops at the daily limit per person", async () => {
    const limitedDeps = deps(fakeClaude().claude, { perPerson: 1 });
    expect((await handleChallenge(post({ challengeId: challenge.id, answer }), limitedDeps)).status).toBe(200);
    expect((await handleChallenge(post({ challengeId: challenge.id, answer }), limitedDeps)).status).toBe(429);
  });
});

describe("POST /api/challenge with a broken reply", () => {
  it("asks once more when the first reply is not JSON", async () => {
    let calls = 0;
    const claude: ClaudeClient = {
      chat: async () => ({ truncated: false }),
      evaluate: async () => "",
      async evaluateChallenge(prompt) {
        calls += 1;
        return calls === 1 ? '{"score": 4, "rationale": "rozbitý' : JSON.stringify(mockChallengeReply(prompt));
      },
    };
    const response = await handleChallenge(post({ challengeId: challenge.id, answer }), deps(claude));
    expect(((await response.json()) as ChallengeResponse).kind).toBe("ok");
    expect(calls).toBe(2);
  });
});
