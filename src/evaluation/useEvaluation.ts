import { useEffect, useRef, useState } from "react";
import type { RoleConfig } from "../roles/roleSchema";
import type { TaskSession } from "../session/sessionSchema";
import type { TaskSessionControls } from "../session/useTaskSession";
import type { AiBackend } from "../ai/aiBackend";
import { attemptFromEvaluation } from "../progress/progress";
import { loadProgress, recordAttempt } from "../progress/progressStorage";
import { isCustomTask } from "../customTask/customTaskRole";
import { track } from "../ai/track";

export type EvaluationRun =
  | { status: "idle" }
  | { status: "running" }
  | { status: "failed"; message: string; canRetry: boolean }
  | { status: "cancelled" };

const invalidReplyMessage = "Hodnotitel vrátil neúplnou odpověď. Pokus se nepočítá, zkus hodnocení spustit znovu.";
// The server finished the evaluation, but this page cannot read the result (an older version).
const unreadableResultMessage = "Hodnocení proběhlo, ale tahle verze stránky neumí výsledek přečíst. Načti stránku znovu a spusť hodnocení ještě jednou. Tenhle pokus se do denního limitu už započítal.";
// The web server gives an attempt back after such a reply once a day (server/rateLimit.ts).
const invalidCountedMessage = "Hodnotitel vrátil neúplnou odpověď. Tentokrát se pokus započítal do denního limitu, protože nepovedený pokus se vrací jen jednou denně. Jestli ti ještě nějaký zbývá, zkus hodnocení spustit znovu.";
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

  // While the evaluator works, closing or reloading the tab asks first: the result would be
  // lost, and on the web the attempt would still count toward the daily limit.
  useEffect(() => {
    if (run.status !== "running") return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [run.status]);

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
      // A generated task is not calibrated, so it moves no skill level and unlocks nothing.
      if (!isCustomTask(role)) {
        const attempt = attemptFromEvaluation(role, outcome.evaluation);
        const earlier = loadProgress().attempts.filter((item) => item.roleId === role.id);
        recordAttempt(attempt);
        // Do people improve by trying again? Only the attempt number and the change of level are sent.
        const previous = earlier.at(-1);
        track("attempt", role.id, { attempt: earlier.length + 1, levelChange: previous ? attempt.level - previous.level : 0 });
      }
      track("task_evaluated", role.id);
      setRun({ status: "idle" });
    } else if (outcome.kind === "missing_key") {
      setRun({ status: "failed", message: "Pro tuhle roli chybí klíč hodnotitele. Dej vědět autorovi.", canRetry: false });
    } else if (outcome.kind === "invalid") {
      const message = outcome.problems.includes("unexpected_shape")
        ? unreadableResultMessage
        : outcome.attemptReturned === false
          ? invalidCountedMessage
          : invalidReplyMessage;
      // Retrying on this old page would fail the same way and use up another attempt.
      setRun({ status: "failed", message, canRetry: !outcome.problems.includes("unexpected_shape") });
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
