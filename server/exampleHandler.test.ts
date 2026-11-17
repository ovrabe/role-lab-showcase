import { describe, expect, it } from "vitest";
import { handleExample, type ExampleResponse } from "./exampleHandler";
import { loadServerContent } from "./content";
import { memoryCounter } from "./rateLimit";

const content = loadServerContent();
const deps = () => ({ content, limiter: { counter: memoryCounter(), secret: "t" } });
const post = (body: unknown) =>
  new Request("http://localhost/api/example", { method: "POST", headers: { origin: "http://localhost", "content-type": "application/json" }, body: JSON.stringify(body) });

describe("the strong sample for the result screen", () => {
  it("returns the sample person's messages, submission and praised quotes", async () => {
    const response = await handleExample(post({ roleId: "qa-release" }), deps());
    const body = (await response.json()) as ExampleResponse;
    expect(body.kind).toBe("ok");
    if (body.kind !== "ok") return;
    expect(body.example.messages.length).toBeGreaterThan(0);
    expect(body.example.submission.length).toBeGreaterThan(0);
    expect(body.example.dimensions).toHaveLength(5);
  });

  it("refuses an unknown task, so the id can never point outside the samples", async () => {
    for (const roleId of ["neexistuje", "../evaluator-data/qa-release.key", "qa-release.key"]) {
      expect((await handleExample(post({ roleId }), deps())).status).toBe(400);
    }
  });

  it("refuses requests from other sites", async () => {
    const request = new Request("http://localhost/api/example", { method: "POST", body: JSON.stringify({ roleId: "qa-release" }) });
    expect((await handleExample(request, deps())).status).toBe(403);
  });
});
