import type { TaskSession } from "../session/sessionSchema";
import type { EvaluatorOutput } from "../evaluation/evaluationSchema";

/**
 * A strong sample attempt of the same task (fixtures/<task>.preview-strong.json), cut down
 * to what the result screen shows next to the person's own work: the sample person's
 * messages, their submission, and per area the score with the quotes the evaluator praised.
 * It reveals the traps, so it is shown only after the person's own evaluation. Shared by
 * the claude.ai page (samples are in the page) and the web server (samples stay on it).
 */
export type StrongExample = {
  messages: { turn: number; text: string }[];
  submission: string;
  dimensions: { id: string; score: number; quotes: { place: number | "submission"; quote: string }[] }[];
};

export function strongExampleFrom(session: Pick<TaskSession, "transcript" | "submission">, output: Pick<EvaluatorOutput, "dimensions">): StrongExample {
  return {
    messages: session.transcript.filter((item) => item.kind === "user" && item.content.trim() !== "").map((item) => ({ turn: item.turn, text: item.content })),
    submission: session.submission,
    dimensions: output.dimensions.map((dimension) => ({
      id: dimension.id,
      score: dimension.score,
      quotes: dimension.evidence.map((evidence) => ({
        place: evidence.turn === "reflection" ? "submission" : evidence.turn,
        quote: evidence.quote,
      })),
    })),
  };
}
