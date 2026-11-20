import { describe, expect, it } from "vitest";
import promptsDocRaw from "../../docs/PROMPTS.md?raw";
import { buildWhyPrompt, whyInstructions, whySchema } from "./why";
import { validateWhyReply } from "../evaluation/whyAnswer";
import { loadRoles } from "../roles/loadRoles";
import { loadPreviewSamples } from "../evaluation/previewFixture";

const promptsDoc = promptsDocRaw.replace(/\r\n/g, "\n");
const blockAfter = (heading: string) => promptsDoc.slice(promptsDoc.indexOf(heading)).match(/```[a-z]*\n([\s\S]*?)\n```/)![1];
const role = loadRoles().activeRoles.find((task) => task.id === "qa-release")!;
const session = loadPreviewSamples(role).find((sample) => sample.id === "weak")!.session;

describe("Proč tohle skóre?", () => {
  it("uses the instructions and schema from docs/PROMPTS.md, section 5", () => {
    expect(whyInstructions).toBe(blockAfter("### Pokyny k vysvětlení skóre").trim());
    expect(whySchema).toBe(blockAfter("### Výstupní schéma vysvětlení").trim());
  });

  it("builds the prompt with the area, its score and the record, nothing for an unknown area", () => {
    const prompt = buildWhyPrompt(role, session, "verification")!;
    const score = session.evaluation!.output.dimensions.find((d) => d.id === "verification")!.score;
    expect(prompt).toContain(`<hodnoceni>Skóre ${score} ze 4.`);
    expect(prompt).toContain("<zaznam>");
    expect(buildWhyPrompt(role, session, "nonsense")).toBeNull();
  });

  it("keeps the answer, marks quotes that are not in the named place, and refuses an empty answer", () => {
    const user = session.transcript.find((item) => item.kind === "user")!;
    const real = user.content.split(/\s+/).slice(0, 4).join(" ");
    const why = validateWhyReply({ answer: "Vysvětlení.", quotes: [{ turn: user.turn, quote: real }, { turn: user.turn, quote: "tohle tam není" }] }, session)!;
    expect(why.quotes.map((quote) => quote.verified)).toEqual([true, false]);
    expect(validateWhyReply({ answer: "  ", quotes: [] }, session)).toBeNull();
    expect(validateWhyReply({ odpoved: "x" }, session)).toBeNull();
  });
});
