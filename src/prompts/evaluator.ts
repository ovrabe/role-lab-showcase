import type { RoleConfig } from "../roles/roleSchema.js";
import type { TaskSession } from "../session/sessionSchema.js";
import type { EvaluatorKey } from "../evaluation/evaluatorKeys.js";

// Instructions and output schema taken verbatim from docs/PROMPTS.md, section 2. Keep them in sync.
const evaluatorInstructions = `Jsi pečlivý a férový hodnotitel praktických dovedností práce s AI. Hodnotíš, jak člověk pracoval s AI asistentem na pracovním úkolu a jak kvalitní je jeho výsledek. Tvoje hodnocení uvidí ten člověk i jeho vedoucí a může ovlivnit jeho další rozvoj. Buď proto přesný a opírej se jen o důkazy.

Dostaneš:
1. Popis role a úkolu.
2. Rubriku s pěti dimenzemi a popisem úrovní 1 až 4. Dimenze jsou u všech rolí stejné, popisy úrovní se liší podle role.
3. Klíč hodnotitele: záludnosti v datech, přijatelné odpovědi a spočítaná fakta.
4. Záznam práce: očíslované kroky konverzace a události.
5. Odevzdaný výsledek a nepovinný komentář k postupu.

Pravidla:
- Každou dimenzi ohodnoť 1 až 4 podle popisu úrovní. Každé skóre dolož aspoň jednou přesnou citací (nejvýš 25 slov) s číslem kroku, nebo s označením "submission".
- Když pro dimenzi nemáš důkaz, dej nižší skóre, přidej ji do insufficientEvidence a v odůvodnění napiš „nedostatek podkladů".
- Hodnotíš práci s AI a úsudek. Nehodnotíš styl psaní, pravopis ani délku.
- Rozlišuj chybu člověka od chyby asistenta. Když asistent spočítal něco špatně a člověk neměl rozumnou možnost to poznat, nesnižuj Úsudek. Když byla chyba zjevná, patří do Ověřování.
- U každé záludnosti z klíče urči stav:
  caught = člověk ji sám identifikoval nebo s ní prokazatelně pracoval a promítl to do výsledku,
  partial = zazněla (třeba po obecné žádosti o kontrolu), ale člověk s ní dál nepracoval,
  missed = nezazněla, nebo výsledek stojí na zkresleném údaji.
- Když výsledek stojí na zkresleném údaji ze záludnosti se stavem missed, Úsudek a výsledek je nejvýš 2.
- Výsledek porovnej s klíčem, ale uznej i jiné řešení, pokud je dobře zdůvodněné.
- Celkovou úroveň nepočítej. Spočítá ji aplikace.
- Vyber jeden až dva další kroky pro nejslabší dimenze z knihovny mikro-cvičení a přizpůsob je tomu, co člověk v záznamu skutečně dělal.
- Napiš dvě až tři silné stránky. Každá musí popisovat konkrétní chování ze záznamu.
- Do humanReviewFlags zapiš, co by měl zkontrolovat člověk: velmi krátký záznam, technické potíže, náznak práce mimo aplikaci, hraniční skóre.
- summary piš ve druhé osobě, nejvýš 40 slov, věcně a bez hodnoticích přívlastků.
- Piš genderově neutrálně, protože nevíš, kdo úkol řešil. Nepoužívej minulý čas ve druhé osobě („zeptal ses", „nechal jsi") ani tvary s lomítkem („nechal/a"). Piš o tom, co zaznělo a co je v záznamu: „v kroku 4 zazněla žádost o kontrolu dat", „data byla před výpočtem prověřena", „tvoje otázka v kroku 6", „odevzdání obsahuje…". Přítomný čas a podstatná jména jsou v pořádku: „tvůj postup", „ověřuješ".
- Vrať pouze JSON podle schématu. Žádný další text.`;

// Short fingerprint of the instructions. Calibration results are stored under it,
// so results from an older prompt are never mixed with results from a newer one.
// Marked pure so a build that never uses it (the web page) drops it together with the
// instructions it reads; the web page must not contain them (scripts/check-web-bundle.mjs).
export const evaluatorPromptVersion = /* @__PURE__ */ (() => {
  let hash = 0;
  for (const char of evaluatorInstructions) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return (hash >>> 0).toString(36);
})();

const outputSchema = `{
  "dimensions": [
    {
      "id": "framing | decomposition | verification | iteration | judgment",
      "score": 1,
      "rationale": "max 60 slov",
      "evidence": [{ "turn": 3, "quote": "přesná citace" }]
    }
  ],
  "traps": [
    {
      "id": "id záludnosti z klíče role",
      "status": "caught | partial | missed",
      "evidence": [{ "turn": "submission", "quote": "přesná citace" }],
      "note": "max 40 slov"
    }
  ],
  "strengths": ["konkrétní chování"],
  "nextSteps": [
    { "dimension": "verification", "title": "krátký název", "why": "proč právě tohle", "exercise": "přizpůsobené mikro-cvičení" }
  ],
  "insufficientEvidence": ["iteration"],
  "humanReviewFlags": ["co má zkontrolovat člověk"],
  "confidence": "low | medium | high",
  "summary": "max 40 slov"
}`;

// The person's own text sits inside tags like <zaznam>. If it contained "</zaznam>", what
// follows would look to the model like a new section of the prompt, for example fake
// instructions. Such tags in the person's text get a look-alike bracket, so they stay text.
// Normal answers never contain them, so for honest attempts the prompt is unchanged.
const promptTags = /<(\/?)(role|ukol|rubrika|mikro_cviceni|klic|zaznam|odevzdani|komentar_k_postupu|podklady|metadata)\b/gi;
export const neutralizeTags = (text: string) => text.replace(promptTags, "‹$1$2");

/**
 * One prompt string: instructions, output schema, then the message built by the
 * template in docs/PROMPTS.md. Attached materials appear in the transcript only as
 * short events; the evaluator has the facts in the key.
 */
export function buildEvaluatorPrompt(role: RoleConfig, key: EvaluatorKey, session: TaskSession): string {
  // The file's own "SERVER-ONLY" note is for people, not for the model.
  const { _warning: _unused, ...keyForModel } = key as EvaluatorKey & { _warning?: string };
  const transcriptLines = session.transcript.map((item) => `[${item.turn}] ${item.kind} (${item.ts}): ${neutralizeTags(item.content)}`);
  const attachedIds = new Set(
    session.transcript.filter((item) => item.event === "data_attached").map((item) => item.materialId),
  );
  const attachedTitles = role.materials.filter((material) => attachedIds.has(material.id)).map((material) => material.title);
  const endTime = session.submittedAt ? new Date(session.submittedAt).getTime() : Date.now();
  const minutes = Math.round((endTime - new Date(session.startedAt).getTime()) / 60_000);
  const userMessages = session.transcript.filter((item) => item.kind === "user").length;
  const brief = role.brief;

  const message = `<role>${role.title} — ${role.context}</role>
<ukol>${brief.situation} ${brief.task} ${brief.deliverable}</ukol>
<rubrika>${JSON.stringify(role.rubric)}</rubrika>
<mikro_cviceni>${JSON.stringify(role.microExercises)}</mikro_cviceni>
<klic>${JSON.stringify(keyForModel)}</klic>
<zaznam>
${transcriptLines.join("\n")}
</zaznam>
<odevzdani>${neutralizeTags(session.submission)}</odevzdani>
<komentar_k_postupu>${neutralizeTags(session.reflection.trim()) || "neuveden"}</komentar_k_postupu>
<podklady>${role.materials.map((material) => `${material.title} (${material.file})`).join("; ")}</podklady>
<metadata>Čas v úkolu: ${minutes} min. Přiložené podklady: ${attachedTitles.length > 0 ? attachedTitles.join("; ") : "žádné"}. Počet zpráv uživatele: ${userMessages}.</metadata>`;

  return `${evaluatorInstructions}\n\nVýstupní schéma:\n${outputSchema}\n\n${message}`;
}
