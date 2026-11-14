import type { RoleConfig } from "../roles/roleSchema.js";
import type { TranscriptItem } from "../session/sessionSchema.js";
import type { ChatTurn } from "../assistant/promptBudget.js";
import type { MaterialTextLookup } from "../roles/parseRoles.js";

// Text taken verbatim from docs/PROMPTS.md, section 1. Keep them in sync.
// The assistant must never receive the evaluator key or hints about data traps.
export function buildAssistantInstructions(role: RoleConfig): string {
  return `Jsi AI asistent, kterého ${role.assistantContext} používají v běžné práci, podobně jako Copilot nebo ChatGPT. Uživatel právě pracuje na pracovním úkolu.

Jak pracuješ:
- Pomáháš s tím, o co tě uživatel požádá: analýza, výpočty, návrhy textu, oponentura.
- S podklady pracuješ jen tehdy, když je uživatel přiloží nebo vloží do konverzace. Nevymýšlíš čísla ani fakta, která v podkladech nejsou. Když něco spočítáš nebo vyvodíš, řekneš z čeho.
- Podklady sám od sebe nekontroluješ a nehledáš v nich chyby ani rozpory, pokud tě o to uživatel nepožádá. Počítáš s nimi tak, jak jsou, a na neobvyklé hodnoty neupozorňuješ, ani když si jich při výpočtu všimneš. Když se ale uživatel zeptá na konkrétní údaj nebo tě o kontrolu požádá, odpovíš pravdivě a úplně.
- O tom, jak se úkol hodnotí, nic nevíš. Když se uživatel zeptá na hodnocení nebo na správnou odpověď, řekneš, že to nevíš, a nabídneš pomoc s analýzou.
- Když tě uživatel požádá o hotový text nebo rozhodnutí, napíšeš ho a uvedeš předpoklady, na kterých stojí.
- Odpovídáš česky, věcně a stručně a uživateli tykáš. Tabulky v Markdownu používáš jen tam, kde pomáhají.`;
}

// Format from docs/PROMPTS.md: each attached material is its own block in the user's message.
function materialBlock(role: RoleConfig, materialId: string, getMaterialText: MaterialTextLookup): string {
  const material = role.materials.find((candidate) => candidate.id === materialId);
  if (!material) return "";
  const text = getMaterialText(material.file) ?? "";
  return `<podklad nazev="${material.title}" soubor="${material.file}">\n${text.trim()}\n</podklad>`;
}

/**
 * Claude remembers nothing between calls and the page has no system prompt,
 * so every call sends the instructions as the first user turn plus the whole
 * conversation so far. The list must end on a user turn.
 *
 * The transcript stores attachments as data_attached events right before the
 * user message they belong to; here they are expanded back into full blocks,
 * so the model sees attached data in every later call and after a reload.
 */
export function buildAssistantTurns(
  role: RoleConfig,
  transcript: TranscriptItem[],
  getMaterialText: MaterialTextLookup,
): ChatTurn[] {
  const conversation: ChatTurn[] = [];
  let attachedIds: string[] = [];

  for (const item of transcript) {
    if (item.event === "data_attached" && item.materialId) {
      attachedIds.push(item.materialId);
    } else if (item.kind === "user") {
      const blocks = attachedIds.map((materialId) => materialBlock(role, materialId, getMaterialText)).filter(Boolean);
      const content = [...blocks, item.content.trim()].filter(Boolean).join("\n\n");
      if (content) conversation.push({ role: "user", content });
      attachedIds = [];
    } else if (item.kind === "assistant" && item.content.trim() !== "") {
      conversation.push({ role: "assistant", content: item.content });
    }
  }
  return [{ role: "user", content: buildAssistantInstructions(role) }, ...conversation];
}
