import { devMockSample } from "../src/runtime/devMockSample.js";
import type { ClaudeClient } from "./claudeClient.js";

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
};
