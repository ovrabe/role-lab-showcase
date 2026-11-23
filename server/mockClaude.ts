import { devMockSample } from "../src/runtime/devMockSample.js";
import { mockChallengeReply } from "../src/challenges/mockChallengeReply.js";
import type { ClaudeClient } from "./claudeClient.js";
import { sampleGeneratedTask } from "../src/customTask/sampleGeneratedTask.js";

/**
 * A fake Claude for local development and tests: the same mock the page uses with
 * ?simulace, so the same triggers work (#chyba:rate_limited in a message, #spatna-citace
 * in a submission). Used only when the server has no API key.
 */
export const mockClaude: ClaudeClient = {
  async chat(turns, { signal, onDelta }) {
    const result = await devMockSample(turns, { signal, onText: ({ delta }) => onDelta(delta) });
    return { truncated: result.truncated };
  },
  async evaluate(prompt, { signal }) {
    const parsed = await devMockSample.json(prompt, { signal });
    return JSON.stringify(parsed);
  },
  async evaluateChallenge(prompt) {
    // The admin summary goes through the same quick model (server/adminHandler.ts).
    if (prompt.startsWith("Píšeš krátké shrnutí provozu")) {
      return JSON.stringify({ headline: "Simulované shrnutí: provoz je klidný.", details: "Tohle napsala simulace pro vývoj, ne Claude. Skutečné shrnutí vznikne na webu z anonymních součtů." });
    }
    return JSON.stringify(mockChallengeReply(prompt));
  },
  async generateCustomTask() {
    return JSON.stringify(sampleGeneratedTask);
  },
};
