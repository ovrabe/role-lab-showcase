// The tester scenario (?testovani): steps in order, each with what to do and its questions.
// Answers go to the author's backlog as one GitHub issue (server/feedbackIssues.ts).
// scale: 1–5 with labelled ends; nps: 0–10; choice: a few options; text: a longer answer;
// line: a short one. Ids stay stable, so an unsent draft survives a change of wording.

export type ScenarioQuestion =
  | { id: string; type: "scale" | "nps"; text: string; ends: [string, string] }
  | { id: string; type: "choice"; text: string; options: string[] }
  | { id: string; type: "text" | "line"; text: string };

export type ScenarioStep = { title: string; minutes: string; todo: string; questions: ScenarioQuestion[] };

const agree: [string, string] = ["nesouhlasím", "souhlasím"];

export const scenarioSteps: ScenarioStep[] = [
  {
    title: "První dojem",
    minutes: "2 minuty",
    todo: "Otevři úvodní stránku aplikace v nové kartě a zatím nic neklikej. Jen se rozhlédni.",
    questions: [
      { id: "q1", type: "scale", text: "Je z úvodu jasné, k čemu Role Lab je?", ends: ["vůbec", "úplně"] },
      { id: "q2", type: "text", text: "Co tě upoutalo jako první a co nebylo jasné?" },
    ],
  },
  {
    title: "Prohlídka",
    minutes: "2 minuty",
    todo: "Na úvodu klikni na „Prohlídka na 2 minuty“ a projdi ji až k hodnocení. Prohlídka nevolá AI a nic neukládá.",
    questions: [
      { id: "q23", type: "scale", text: "Po prohlídce je jasné, jak úkol probíhá a jak se hodnotí.", ends: agree },
      { id: "q24", type: "text", text: "Co v prohlídce chybělo nebo bylo navíc?" },
    ],
  },
  {
    title: "Výzva dne",
    minutes: "5 minut",
    todo: "Na úvodu klikni na „Začít výzvu“. Přečti situaci a výstup AI, napiš odpověď a odevzdej ji. Hodnocení přijde za pár sekund.",
    questions: [
      { id: "q3", type: "scale", text: "Zadání výzvy bylo srozumitelné.", ends: agree },
      { id: "q4", type: "scale", text: "Hodnocení odpovídalo kvalitě tvé odpovědi.", ends: agree },
      { id: "q5", type: "text", text: "Co z výsledku bylo užitečné a co ne?" },
    ],
  },
  {
    title: "Úkol obtížnosti 1",
    minutes: "15 až 20 minut",
    todo: "Na úvodu vyber roli, která je nejblíž tvé práci (je jich osm, od category managera po mikrobiologii), a v ní úkol „Obtížnost 1 · Základní“. Přečti zadání, prohlédni podklady, pracuj s asistentem jako v běžné práci a odevzdej výsledek. Hodnocení trvá minutu až dvě.",
    questions: [
      { id: "q26", type: "line", text: "Vybraná role a úkol" },
      { id: "q6", type: "scale", text: "Zadání a podklady byly jasné.", ends: agree },
      { id: "q25", type: "scale", text: "Situace a data v úkolu odpovídají tomu, jak to v té práci opravdu chodí.", ends: agree },
      { id: "q7", type: "scale", text: "Práce s asistentem fungovala dobře.", ends: agree },
      { id: "q8", type: "scale", text: "Hodnocení bylo férové a citace v něm sedí.", ends: agree },
      { id: "q9", type: "scale", text: "Rozbor toho, co bylo v datech schované, mi dal smysl.", ends: agree },
      { id: "q10", type: "text", text: "Co by stálo za změnu na úkolu nebo na hodnocení?" },
    ],
  },
  {
    title: "Profil a pokrok",
    minutes: "3 minuty",
    todo: "Vpravo nahoře klikni na svou ikonu, otevře se profil. Podívej se na dovednosti a odznaky a zkus změnit ikonu.",
    questions: [
      { id: "q11", type: "scale", text: "Profil a odznaky mě lákají zkusit další úkol nebo výzvu.", ends: agree },
      { id: "q12", type: "text", text: "Co ti na profilu chybí nebo co je navíc?" },
    ],
  },
  {
    title: "Orientace",
    minutes: "3 minuty",
    todo: "Projdi pár obrazovek (mapa výzev, Jak hodnotíme, úkoly role) a vracej se šipkou vlevo nahoře nebo tlačítkem zpět v prohlížeči. Pokud můžeš, otevři aplikaci i na telefonu.",
    questions: [
      { id: "q13", type: "scale", text: "V aplikaci se snadno orientuješ.", ends: agree },
      { id: "q14", type: "text", text: "Kde nebylo jasné, kam dál, nebo co se stane po kliknutí?" },
    ],
  },
  {
    title: "Celkově",
    minutes: "5 minut",
    todo: "Na závěr pár otázek k celé aplikaci.",
    questions: [
      { id: "q15", type: "nps", text: "Jak pravděpodobné je, že Role Lab doporučíš kolegovi nebo kolegyni?", ends: ["vůbec", "určitě"] },
      { id: "q16", type: "choice", text: "Vrátíš se zítra k výzvě dne?", options: ["Ano", "Možná", "Ne"] },
      { id: "q17", type: "text", text: "Co bylo nejlepší?" },
      { id: "q18", type: "text", text: "Co nejvíc vadilo nebo chybělo?" },
      { id: "q19", type: "text", text: "Jaká role nebo jaký úkol by tě zajímal?" },
      { id: "q20", type: "text", text: "Objevila se nějaká chyba? Popiš, co byl tvůj krok, co se mělo stát a co se stalo." },
      { id: "q21", type: "line", text: "Tvoje role nebo obor (nepovinné)" },
      { id: "q22", type: "line", text: "Zařízení a prohlížeč (nepovinné)" },
    ],
  },
];

export type ScenarioAnswers = Record<string, string>;

/** What the server receives: only answered questions, in scenario order, with their wording. */
export function reportAnswers(answers: ScenarioAnswers) {
  return scenarioSteps.flatMap((step) =>
    step.questions
      .filter((question) => (answers[question.id] ?? "").trim() !== "")
      .map((question) => ({ step: step.title, question: question.text, answer: answers[question.id].trim() })),
  );
}
