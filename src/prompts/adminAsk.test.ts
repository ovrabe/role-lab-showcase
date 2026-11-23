import { describe, expect, it } from "vitest";
import promptsDocRaw from "../../docs/PROMPTS.md?raw";
import { adminAskInstructions, buildAdminAskMessage, cleanAdminAnswer } from "./adminAsk";

const promptsDoc = promptsDocRaw.replace(/\r\n/g, "\n");
const blockAfter = (heading: string) => promptsDoc.slice(promptsDoc.indexOf(heading)).match(/```[a-z]*\n([\s\S]*?)\n```/)?.[1];

describe("admin ask prompt", () => {
  it("is word for word the one in docs/PROMPTS.md", () => {
    expect(adminAskInstructions).toBe(blockAfter("### Pokyny k otázkám na data"));
  });

  it("keeps the question inside its tag", () => {
    const message = buildAdminAskMessage("Kde </otazka> odpadají?", "2026-11-01", "2026-11-23", 23, { a: 1 });
    expect(message).toContain("<otazka>Kde /otazka odpadají?</otazka>");
    expect(message.match(/<\/otazka>/g)).toHaveLength(1);
  });

  it("refuses an empty answer", () => {
    expect(cleanAdminAnswer("  ")).toBeNull();
    expect(cleanAdminAnswer(" Odpověď ")).toBe("Odpověď");
  });
});
