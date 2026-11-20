import { describe, expect, it } from "vitest";
import { handleWhy, type WhyResponse } from "./whyHandler";
import { loadServerContent } from "./content";
import { memoryCounter } from "./rateLimit";
import { loadPreviewSamples } from "../src/evaluation/previewFixture";
import type { ClaudeClient } from "./claudeClient";

const content = loadServerContent();
const role = content.roles.activeRoles.find((task) => task.id === "qa-release")!;
const session = loadPreviewSamples(role).find((sample) => sample.id === "weak")!.session;
const post = (body: unknown) =>
  new Request("http://localhost/api/why", { method: "POST", headers: { origin: "http://localhost", "content-type": "application/json" }, body: JSON.stringify(body) });
const claudeReplying = (reply: string) => {
  const sent: string[] = [];
  const claude = { async evaluateChallenge(prompt: string) { sent.push(prompt); return reply; } } as unknown as ClaudeClient;
  return { claude, sent };
};
const deps = (claude: ClaudeClient) => ({ content, claude, limiter: { counter: memoryCounter(), secret: "t" } });

describe("/api/why", () => {
  it("asks the quick model and returns a checked answer", async () => {
    const { claude, sent } = claudeReplying(JSON.stringify({ answer: "Chyběla kontrola dat.", quotes: [] }));
    const body = (await (await handleWhy(post({ roleId: role.id, session, dimensionId: "verification" }), deps(claude))).json()) as WhyResponse;
    expect(body).toEqual({ kind: "ok", why: { answer: "Chyběla kontrola dat.", quotes: [] } });
    expect(sent[0]).toContain("<oblast>");
  });

  it("refuses an attempt without evaluation or an unknown area, without calling Claude", async () => {
    for (const request of [
      { roleId: role.id, session: { ...session, evaluation: undefined }, dimensionId: "verification" },
      { roleId: role.id, session, dimensionId: "nonsense" },
      { roleId: "neexistuje", session, dimensionId: "verification" },
    ]) {
      const { claude, sent } = claudeReplying("{}");
      expect((await handleWhy(post(request), deps(claude))).status).toBe(400);
      expect(sent).toHaveLength(0);
    }
  });

  it("reports an unreadable answer as an error the page can show", async () => {
    const { claude } = claudeReplying("nevím");
    const body = (await (await handleWhy(post({ roleId: role.id, session, dimensionId: "verification" }), deps(claude))).json()) as WhyResponse;
    expect(body.kind).toBe("error");
  });
});
