import { z } from "zod";
import { DimensionId } from "../roles/roleSchema.js";

// Short challenges (docs/PRODUCTION.md, part 10, phase 2): one skill, about five minutes,
// one written answer and one evaluation. Shared by both roles, so nothing here names a role.
// A new challenge is two files: the public part in data/challenges/<id>.json and the
// evaluator's key in evaluator-data/challenges/<id>.key.json.

const nonEmpty = z.string().trim().min(1);

/** What the person sees: the situation, the AI's output to work with, and the task. */
export const ChallengeConfig = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, "Jen malá písmena, číslice a pomlčky."),
  skill: DimensionId,
  // Position among the challenges of the same skill on the challenge map (1 = first).
  order: z.number().int().min(1),
  title: nonEmpty,
  minutes: z.number().int().positive(),
  // Markdown: the situation and any source the person can check the AI's output against.
  situation: nonEmpty,
  // Markdown: what the AI produced. The traps are hidden in here, never named.
  aiOutput: nonEmpty,
  task: nonEmpty,
  // What a score of 1–4 means for this challenge, in the language of the skill.
  rubric: z.object({ "1": nonEmpty, "2": nonEmpty, "3": nonEmpty, "4": nonEmpty }),
});
export type ChallengeConfig = z.infer<typeof ChallengeConfig>;

const ChallengeTrap = z.object({
  id: nonEmpty,
  title: nonEmpty,
  whatIsWrong: nonEmpty,
  caughtIf: nonEmpty,
});

/** Only for the evaluator. Never shown before the answer is submitted, never in the web page. */
export const ChallengeKey = z.object({
  challengeId: nonEmpty,
  traps: z.array(ChallengeTrap).min(1),
  // What a level-4 answer contains, so the evaluator does not invent its own standard.
  strongAnswer: nonEmpty,
});
export type ChallengeKey = z.infer<typeof ChallengeKey>;
