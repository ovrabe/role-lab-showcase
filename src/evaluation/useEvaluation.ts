import { useEffect, useRef, useState } from "react";
import type { RoleConfig } from "../roles/roleSchema";
import type { TaskSession } from "../session/sessionSchema";
import type { TaskSessionControls } from "../session/useTaskSession";
import type { AiBackend } from "../ai/aiBackend";
import { attemptFromEvaluation } from "../progress/progress";
import { recordAttempt } from "../progress/progressStorage";

export type EvaluationRun =
  | { status: "idle" }
  | { status: "running" }
  | { status: "failed"; message: string; canRetry: boolean }
  | { status: "cancelled" };

const invalidReplyMessage = "Hodnotitel vrátil neúplnou odpověď. Zkus hodnocení spustit znovu.";
const blockedMessage =
  "Volání Clauda není pro tuhle stránku povolené, takže hodnocení nemůže proběhnout. Odevzdaný text zůstává uložený.";

/**
 * Runs the evaluator once per explicit action (submit or "Zkusit znovu"),
 * never on load and never in a retry loop (docs/RUNTIME.md).
 */
export function useEvaluation(role: RoleConfig, controls: TaskSessionControls, backend: AiBackend | null) {
  const [run, setRun] = useState<EvaluationRun>({ status: "idle" });
  const abortRef = useRef<AbortController | null>(null);

  // Leaving the screen cancels a running evaluation; it can be started again later.
  useEffect(() => () => abortRef.current?.abort(), []);

  async function evaluate(session: TaskSession) {
    if (!backend) return;
    const controller = new AbortController(); // a new controller for every call
    abortRef.current = controller;
    setRun({ status: "running" });
    const outcome = await backend.evaluate(role, session, controller.signal);
    abortRef.current = null;

    if (outcome.kind === "ok") {
      controls.saveEvaluation(outcome.evaluation);
      // Only the person's own evaluations count; samples and calibration never pass here.
      recordAttempt(attemptFromEvaluation(role, outcome.evaluation));
      setRun({ status: "idle" });
    } else if (outcome.kind === "missing_key") {
      setRun({ status: "failed", message: "Pro tuhle roli chybí klíč hodnotitele. Dej vědět autorovi.", canRetry: false });
    } else if (outcome.kind === "invalid") {
      setRun({ status: "failed", message: invalidReplyMessage, canRetry: true });
    } else if (outcome.handling.kind === "silent") {
      setRun({ status: "cancelled" });
    } else if (outcome.handling.kind === "blocked") {
      setRun({ status: "failed", message: blockedMessage, canRetry: false });
    } else {
      setRun({ status: "failed", message: outcome.handling.message, canRetry: outcome.handling.offerRetry });
    }
  }

  return {
    run,
    evaluate: (session: TaskSession) => void evaluate(session),
    cancel: () => abortRef.current?.abort(),
  };
}
