import { describe, expect, it } from "vitest";
import promptsDocRaw from "../../docs/PROMPTS.md?raw";
import { adminSummaryInstructions, adminSummarySchema, buildAdminSummaryPrompt, validateAdminSummary } from "./adminSummary";
import { digest } from "../admin/digest";

const promptsDoc = promptsDocRaw.replace(/\r\n/g, "\n");
const blockAfter = (heading: string) => promptsDoc.slice(promptsDoc.indexOf(heading)).match(/```[a-z]*\n([\s\S]*?)\n```/)?.[1];

describe("admin summary prompt", () => {
  it("is word for word the one in docs/PROMPTS.md", () => {
    expect(adminSummaryInstructions).toBe(blockAfter("### Pokyny ke shrnutí"));
    expect(adminSummarySchema).toBe(blockAfter("### Výstupní schéma shrnutí"));
  });

  it("carries only the totals of both periods", () => {
    const current = digest([{ day: "2026-11-23", visitors: 5, metrics: { "funnel.qa.started": 2 } }]);
    const prompt = buildAdminSummaryPrompt("2026-11-23", "2026-11-23", current, digest([]));
    expect(prompt).toContain('"visitors":5');
    expect(prompt).toContain("<obdobi>2026-11-23 až 2026-11-23 (1 dní)</obdobi>");
  });

  it("accepts two short texts and nothing else", () => {
    expect(validateAdminSummary({ headline: " A ", details: "B" })).toEqual({ headline: "A", details: "B" });
    expect(validateAdminSummary({ headline: "", details: "B" })).toBeNull();
    expect(validateAdminSummary("text")).toBeNull();
  });
});
