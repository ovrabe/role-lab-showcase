import type { SampleFunction } from "./useAiAvailability.js";

// Development-only stand-in for claude.use("sample"), opened with ?simulace.
// It is loaded only behind import.meta.env.DEV, so the published page never contains it.
// The web server reuses it when it runs without an API key (local development, tests);
// globalThis instead of window keeps it working in Node too.
// Trigger errors from a chat message:
//   "#chyba:rate_limited"        rejects before any text
//   "#chyba-po:upstream_error"   rejects halfway through the answer

type MockInput = Parameters<SampleFunction>[0];
type MockOptions = NonNullable<Parameters<SampleFunction>[1]>;

const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function lastUserText(input: MockInput): string {
  if (typeof input === "string") return input;
  return [...input].reverse().find((turn) => turn.role === "user")?.content ?? "";
}

function mockReply(input: MockInput): string {
  const turnCount = typeof input === "string" ? 1 : input.length;
  const firstTurn = typeof input === "string" ? input : input[0].content;
  const allText = typeof input === "string" ? input : input.map((turn) => turn.content).join("\n");
  const attachedBlocks = allText.match(/<podklad /g)?.length ?? 0;
  return [
    "**Simulovaná odpověď** (jen pro vývoj, nejde o Clauda).",
    "",
    `Dostal jsem ${turnCount} tahů a ${attachedBlocks} bloků s podklady (${allText.length} znaků). Pokyny začínají slovy: „${firstTurn.slice(0, 60)}…“`,
    "",
    "| Produkt | Kusy | Marže |",
    "|---|---:|---:|",
    "| ARV-101 | 2 674 | 32,9 % |",
    "| VRD-215 | 1 099 | 41,0 % |",
    "",
    "- první bod",
    "- druhý bod s delším textem, aby bylo vidět zalamování řádků v panelu asistenta",
  ].join("\n");
}

async function mockSample(input: MockInput, options: MockOptions = {}) {
  const { signal, onText } = options;
  const userText = lastUserText(input);
  // Lets a developer inspect exactly what the assistant received.
  (globalThis as { lastAssistantInput?: MockInput }).lastAssistantInput = input;
  const errorBefore = userText.match(/#chyba:(\w+)/)?.[1];
  const errorHalfway = userText.match(/#chyba-po:(\w+)/)?.[1];

  const cancelledCheck = (text: string) => {
    if (signal?.aborted) throw { code: "cancelled", message: "Mock aborted", ...(text ? { text } : {}) };
  };

  // "Thinking" before the first text, like the real default tier.
  await wait(1200);
  cancelledCheck("");
  if (errorBefore) throw { code: errorBefore, message: `Mock error ${errorBefore}` };

  const words = mockReply(input).split(/(?<=\s)/);
  let text = "";
  for (let index = 0; index < words.length; index++) {
    if (errorHalfway && index === Math.floor(words.length / 2)) {
      throw { code: errorHalfway, message: `Mock error ${errorHalfway}`, text };
    }
    await wait(40);
    cancelledCheck(text);
    text += words[index];
    onText?.({ text, delta: words[index] });
  }
  return { text, truncated: false, modelTierApplied: "default" as const };
}

// Fake evaluator: builds a reply from the prompt so quotes really exist in it.
// Triggers in the submitted text:
//   "#chyba:invalid_json" etc.  rejects with that code
//   "#spatny-tvar"              returns JSON of a wrong shape
//   "#chybi-dimenze"            leaves out one dimension
//   "#spatna-citace"            cites a quote that is not in the record
async function mockJson(input: MockInput, options: MockOptions = {}) {
  const prompt = typeof input === "string" ? input : input.map((turn) => turn.content).join("\n");
  const submission = prompt.match(/<odevzdani>([\s\S]*?)<\/odevzdani>/)?.[1] ?? "";
  // Lets a developer inspect exactly what the evaluator received.
  (globalThis as { lastEvaluatorPrompt?: string }).lastEvaluatorPrompt = prompt;
  await wait(1500);
  if (options.signal?.aborted) throw { code: "cancelled", message: "Mock aborted" };
  // Set window.mockNextEvaluatorError = "rate_limited" in the console to fail the next evaluation.
  const devWindow = globalThis as { mockNextEvaluatorError?: string };
  const errorCode = submission.match(/#chyba:(\w+)/)?.[1] ?? devWindow.mockNextEvaluatorError;
  devWindow.mockNextEvaluatorError = undefined;
  if (errorCode) throw { code: errorCode, message: `Mock error ${errorCode}` };
  if (submission.includes("#spatny-tvar")) return { hodnoceni: "nevím" };

  const firstUserLine = prompt.match(/^\[(\d+)\] user \([^)]*\): (.+)$/m);
  const userEvidence = firstUserLine
    ? { turn: Number(firstUserLine[1]), quote: firstUserLine[2].split(" ").slice(0, 6).join(" ") }
    : { turn: "submission", quote: submission.split(/\s+/).slice(0, 5).join(" ") };
  // window.mockNextEvaluatorBadQuote = true in the console makes the next evaluation cite a missing quote.
  const badQuoteWindow = globalThis as { mockNextEvaluatorBadQuote?: boolean };
  const useBadQuote = submission.includes("#spatna-citace") || badQuoteWindow.mockNextEvaluatorBadQuote === true;
  badQuoteWindow.mockNextEvaluatorBadQuote = undefined;
  const submissionEvidence = useBadQuote
    ? { turn: "submission", quote: "tahle věta v odevzdání není" }
    : { turn: "submission", quote: submission.trim().split(/\s+/).slice(0, 5).join(" ") };
  const trapIds = [...prompt.matchAll(/"id":"(T\d_[a-z0-9_]+)"/g)].map((match) => match[1]);

  // More user messages = better simulated work, so calibration can be tried end to end:
  // 1 message scores like a weak run, 2–4 like a medium one, 5+ like a strong one.
  const userMessages = (prompt.match(/^\[\d+\] user \(/gm) ?? []).length;
  const tier = userMessages <= 1 ? 0 : userMessages <= 4 ? 1 : 2;
  const scoresByTier = [
    [1, 1, 1, 1, 1],
    [3, 3, 2, 3, 2],
    [4, 4, 4, 3, 4],
  ];
  const trapStatusesByTier = [
    ["missed", "missed"],
    ["missed", "caught"],
    ["caught", "caught"],
  ];

  const dimensions = ["framing", "decomposition", "verification", "iteration", "judgment"]
    .filter((id) => !(submission.includes("#chybi-dimenze") && id === "iteration"))
    .map((id, index) => ({
      id,
      score: scoresByTier[tier][index],
      rationale: `Simulované odůvodnění pro ${id}.`,
      evidence: [id === "judgment" ? submissionEvidence : userEvidence],
    }));

  return {
    dimensions,
    traps: trapIds.map((id, index) => ({
      id,
      status: trapStatusesByTier[tier][index] ?? "partial",
      evidence: [],
      note: "Simulovaná poznámka.",
    })),
    strengths: ["Simulovaná silná stránka."],
    nextSteps: [{ dimension: "verification", title: "Ověř čísla", why: "Simulace.", exercise: "Simulované cvičení." }],
    insufficientEvidence: [],
    humanReviewFlags: ["Simulované hodnocení, nejde o Clauda."],
    confidence: "medium",
    summary: "Simulované shrnutí hodnocení.",
  };
}

export const devMockSample = Object.assign(mockSample, {
  json: mockJson,
  limits: async () => ({ maxPromptBytes: 262144 }),
}) as unknown as SampleFunction;
