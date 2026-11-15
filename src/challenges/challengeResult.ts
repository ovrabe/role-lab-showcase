import { z } from "zod";
import type { ChallengeKey } from "./challengeSchema.js";
import { quoteAppearsIn } from "../evaluation/verifyQuote.js";
import type { SampleErrorHandling } from "../assistant/sampleErrors.js";

// Checks the evaluator's reply to a challenge (docs/PROMPTS.md, section 4) and turns it
// into what the page shows. The model's reply is never trusted as it is: the score must be
// 1–4, every quote is checked against the answer, every trap from the key gets a status.

export const minAnswerChars = 20;
export const maxAnswerChars = 4000;

const TrapStatus = z.enum(["caught", "partial", "missed"]);
export type ChallengeTrapStatus = z.infer<typeof TrapStatus>;

const RawReply = z.object({
  score: z.number().int().min(1).max(4),
  rationale: z.string().trim().min(1),
  evidence: z.array(z.object({ quote: z.string() })).default([]),
  traps: z.array(z.object({ id: z.string(), status: TrapStatus, quote: z.string().default("") })).default([]),
  tip: z.string().default(""),
  humanReviewFlags: z.array(z.string()).default([]),
});

/** What the page shows and stores. Trap titles and explanations come from the key, after submission. */
export const ChallengeResult = z.object({
  score: z.number().int().min(1).max(4),
  rationale: z.string(),
  evidence: z.array(z.object({ quote: z.string(), verified: z.boolean() })),
  traps: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      whatIsWrong: z.string(),
      status: TrapStatus,
      quote: z.string(),
      quoteVerified: z.boolean(),
    }),
  ),
  tip: z.string(),
  humanReviewFlags: z.array(z.string()),
});
export type ChallengeResult = z.infer<typeof ChallengeResult>;

export type ChallengeValidation = { ok: true; result: ChallengeResult } | { ok: false; problems: string[] };

export function validateChallengeReply(raw: unknown, key: ChallengeKey, answer: string): ChallengeValidation {
  const parsed = RawReply.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, problems: parsed.error.issues.map((issue) => `${issue.path.map(String).join(".") || "reply"}: ${issue.message}`) };
  }
  const reply = parsed.data;
  const flags = [...reply.humanReviewFlags];

  const evidence = reply.evidence
    .filter((item) => item.quote.trim() !== "")
    .map((item) => ({ quote: item.quote, verified: quoteAppearsIn(item.quote, answer) }));
  if (evidence.some((item) => !item.verified)) flags.push("Některá citace v odpovědi není doslova.");

  // Every trap of the key, in the key's order; unknown ids from the model are dropped.
  const traps = key.traps.map((trap) => {
    const judged = reply.traps.find((item) => item.id === trap.id);
    if (!judged) flags.push(`Hodnotitel neuvedl stav záludnosti „${trap.title}“, počítá se jako přehlédnutá.`);
    const quote = judged && judged.status !== "missed" ? judged.quote : "";
    return {
      id: trap.id,
      title: trap.title,
      whatIsWrong: trap.whatIsWrong,
      status: judged?.status ?? "missed",
      quote,
      quoteVerified: quote !== "" && quoteAppearsIn(quote, answer),
    };
  });

  if (traps.some((trap) => trap.quote !== "" && !trap.quoteVerified)) flags.push("Citace u některé záludnosti v odpovědi není doslova.");

  return {
    ok: true,
    result: { score: reply.score, rationale: reply.rationale, evidence, traps, tip: reply.tip, humanReviewFlags: flags },
  };
}

/** One challenge evaluation, the same for every backend (mirrors ChallengeResponse on the server). */
export type ChallengeOutcome =
  | { kind: "ok"; result: ChallengeResult }
  // The reply came but could not be used (wrong shape, score out of range).
  | { kind: "invalid"; problems: string[] }
  | { kind: "error"; handling: SampleErrorHandling }
  | { kind: "missing_key" };
