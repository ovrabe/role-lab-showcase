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

// Ordered as why, what, how, what if: what the app is for, how it works, how it feels to use,
// and what the tester gets out of it. About 10 minutes; the full role task is an optional extra.
export const scenarioSteps: ScenarioStep[] = [
  {
    title: "Proč: k čemu Role Lab je",
    minutes: "2 minuty",
    todo: "Otevři Role Lab v nové kartě a přečti si úvod. Jestli chceš, klikni na „O projektu“. Nic dalšího zatím nezkoušej.",
    questions: [
      { id: "q27", type: "text", text: "Napiš jednou větou, k čemu podle tebe Role Lab je a pro koho." },
      { id: "q28", type: "scale", text: "Je jasné, proč aplikace vznikla?", ends: ["vůbec", "úplně"] },
    ],
  },
  {
    title: "Co: prohlídka",
    minutes: "2 minuty",
    todo: "Na úvodu klikni na „Prohlídka na 2 minuty“ a projdi ji až k hodnocení. Prohlídka nevolá AI a nic neukládá.",
    questions: [
      { id: "q23", type: "scale", text: "Po prohlídce je jasné, jak úkol probíhá a jak se hodnotí.", ends: agree },
    ],
  },
  {
    title: "Jak: výzva dne a volné proklikání",
    minutes: "5 minut",
    todo: "Na úvodu klikni na kartu „Výzva dne“, napiš odpověď a odevzdej ji. Hodnocení přijde za pár sekund. Pak se chvíli volně proklikej: role a jejich úkoly, profil vpravo nahoře, mapa výzev přes odkaz „Všechny výzvy“.",
    questions: [
      { id: "q4", type: "scale", text: "Hodnocení výzvy odpovídalo kvalitě tvé odpovědi.", ends: agree },
      { id: "q13", type: "scale", text: "V aplikaci se snadno orientuješ.", ends: agree },
      { id: "q29", type: "scale", text: "Texty a pokyny v aplikaci jsou srozumitelné.", ends: agree },
      { id: "q14", type: "text", text: "Kde nebylo jasné, co dál, co se stane po kliknutí nebo co znamená nějaký text?" },
    ],
  },
  {
    title: "Co když: co ti to dá",
    minutes: "1 minuta",
    todo: "Už nic neklikej, jen odpověz.",
    questions: [
      { id: "q30", type: "text", text: "Co by ti pravidelné používání Role Labu přineslo?" },
      { id: "q16", type: "choice", text: "Vrátíš se k Role Labu?", options: ["Ano", "Možná", "Ne"] },
      { id: "q31", type: "text", text: "Proč ano, nebo proč ne?" },
    ],
  },
  {
    title: "Na závěr",
    minutes: "1 minuta",
    todo: "Pár údajů na konec. Všechno je nepovinné.",
    questions: [
      { id: "q20", type: "text", text: "Objevila se nějaká chyba? Popiš, co byl tvůj krok, co se mělo stát a co se stalo." },
      { id: "q21", type: "line", text: "Tvoje role nebo obor" },
      { id: "q22", type: "line", text: "Zařízení a prohlížeč" },
    ],
  },
  {
    title: "Navíc, když máš čas: úkol z role",
    minutes: "15 minut, nepovinné",
    todo: "Když máš čtvrt hodiny navíc: na úvodu vyber roli, která je nejblíž tvé práci, a v ní úkol „Obtížnost 1 · Základní“. Pracuj s asistentem jako v běžné práci a odevzdej výsledek. Hodnocení trvá minutu až dvě.",
    questions: [
      { id: "q26", type: "line", text: "Vybraná role a úkol" },
      { id: "q6", type: "scale", text: "Zadání a podklady byly jasné.", ends: agree },
      { id: "q8", type: "scale", text: "Hodnocení bylo férové a citace v něm sedí.", ends: agree },
      { id: "q10", type: "text", text: "Co by stálo za změnu na úkolu nebo na hodnocení?" },
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
