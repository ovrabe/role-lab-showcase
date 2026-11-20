import { z } from "zod";
import type { TaskSession } from "../session/sessionSchema.js";
import { quoteAppearsIn } from "./verifyQuote.js";

/**
 * The answer to "Proč tohle skóre?" (docs/PROMPTS.md, section 5), checked like an evaluation:
 * a non-empty answer, and every quote looked up in the step it names or in the submission.
 */
const WhyReply = z.object({
  answer: z.string().trim().min(1),
  quotes: z
    .array(z.object({ turn: z.union([z.literal("submission"), z.number().int(), z.string().regex(/^\d+$/).transform(Number)]), quote: z.string() }))
    .default([]),
});

export const StoredWhy = z.object({
  answer: z.string(),
  quotes: z.array(z.object({ place: z.union([z.number(), z.literal("submission")]), quote: z.string(), verified: z.boolean() })),
});
export type StoredWhy = z.infer<typeof StoredWhy>;

export function validateWhyReply(raw: unknown, session: Pick<TaskSession, "transcript" | "submission">): StoredWhy | null {
  const parsed = WhyReply.safeParse(raw);
  if (!parsed.success) return null;
  return {
    answer: parsed.data.answer,
    quotes: parsed.data.quotes.slice(0, 3).map(({ turn, quote }) => {
      const source = turn === "submission" ? session.submission : (session.transcript.find((item) => item.turn === turn)?.content ?? "");
      return { place: turn, quote, verified: quoteAppearsIn(quote, source) };
    }),
  };
}

export type WhyOutcome = { kind: "ok"; why: StoredWhy } | { kind: "error"; message: string };
