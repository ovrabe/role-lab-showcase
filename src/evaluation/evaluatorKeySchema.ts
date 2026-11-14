import { z } from "zod";

// Evaluator keys (traps, acceptable answers, computed facts). They are bundled
// into the page, which docs/SPEC.md section 5 accepts for the demo, but only
// the evaluator prompt may use them: never the assistant, never the UI before submission.
// Keep imports of this module to the evaluation code. No file access here: the page loads
// the key files through Vite (evaluatorKeys.ts), the web server from disk (server/content.ts).

// Only what the page itself relies on is checked; the rest is passed to the evaluator as written.
const EvaluatorKey = z
  .object({
    roleId: z.string(),
    traps: z.array(
      z
        .object({
          id: z.string(),
          title: z.string(),
          whatIsWrong: z.string(),
        })
        .loose(),
    ),
  })
  .loose();
export type EvaluatorKey = z.infer<typeof EvaluatorKey>;

/** Finds and validates the key of one role among loaded key files. No file access here. */
export function findEvaluatorKey(keyFiles: Record<string, unknown>, roleId: string): EvaluatorKey | null {
  for (const content of Object.values(keyFiles)) {
    const result = EvaluatorKey.safeParse(content);
    if (result.success && result.data.roleId === roleId) return result.data;
  }
  return null;
}
