import { describe, expect, it } from "vitest";
import promptsDocRaw from "../../docs/PROMPTS.md?raw";
import { buildAssistantInstructions } from "./assistant";
import { buildEvaluatorPrompt } from "./evaluator";
import { loadRoles } from "../roles/loadRoles";
import { getEvaluatorKey } from "../evaluation/evaluatorKeys";
import { loadPreviewSamples } from "../evaluation/previewFixture";

// docs/PROMPTS.md is the source of truth; the code must send exactly its wording.
const promptsDoc = promptsDocRaw.replace(/\r\n/g, "\n");

// The first fenced block after a heading, without the fences.
function codeBlockAfter(heading: string): string {
  const start = promptsDoc.indexOf(heading);
  if (start < 0) throw new Error(`Heading not found in docs/PROMPTS.md: ${heading}`);
  const match = promptsDoc.slice(start).match(/```[a-z]*\n([\s\S]*?)\n```/);
  if (!match) throw new Error(`No code block after: ${heading}`);
  return match[1];
}

const { activeRoles } = loadRoles();

describe.each(activeRoles.map((role) => [role.id, role] as const))("prompts match docs/PROMPTS.md (%s)", (_id, role) => {
  it("assistant instructions", () => {
    const documented = codeBlockAfter("### Pokyny (první zpráva)").replace(
      "{{role.assistantContext}}",
      role.assistantContext,
    );
    expect(buildAssistantInstructions(role)).toBe(documented);
  });

  it("evaluator instructions and output schema", () => {
    const instructions = codeBlockAfter("## 2. Hodnotitel").trim();
    const schema = codeBlockAfter("### Výstupní schéma").trim();

    const session = loadPreviewSamples(role)[0].session;
    const prompt = buildEvaluatorPrompt(role, getEvaluatorKey(role.id)!, session);
    expect(prompt.startsWith(`${instructions}\n\nVýstupní schéma:\n`)).toBe(true);
    expect(prompt).toContain(schema);
  });
});
