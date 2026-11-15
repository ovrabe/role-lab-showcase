import { useEffect, useRef, useState } from "react";
import type { AiBackend } from "../ai/aiBackend";
import type { AiAvailability } from "../runtime/useAiAvailability";
import type { ChallengeConfig } from "../challenges/challengeSchema";
import { maxAnswerChars, minAnswerChars, type ChallengeOutcome } from "../challenges/challengeResult";
import { ChallengeResultView } from "../challenges/ChallengeResultView";
import { recordChallenge, recordFromResult } from "../challenges/challengeProgress";
import { Markdown } from "../components/Markdown";
import { skillNames } from "../roles/skillNames";

type ChallengeScreenProps = {
  challenge: ChallengeConfig;
  aiStatus: AiAvailability;
  backend: AiBackend | null;
  onBack: () => void;
};

type Phase = { name: "answering" } | { name: "evaluating" } | { name: "done"; outcome: ChallengeOutcome };

/** One short challenge: situation, the AI's output, the task, one answer, one evaluation. */
export function ChallengeScreen({ challenge, aiStatus, backend, onBack }: ChallengeScreenProps) {
  const [answer, setAnswer] = useState("");
  const [phase, setPhase] = useState<Phase>({ name: "answering" });
  const abort = useRef<AbortController | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0 });
    return () => abort.current?.abort();
  }, []);

  // The result sits right under the answer it judges; bring it into view when it arrives.
  useEffect(() => {
    if (phase.name === "done") resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [phase.name]);

  const trimmedLength = answer.trim().length;
  const canSubmit = aiStatus === "available" && backend !== null && trimmedLength >= minAnswerChars && phase.name === "answering";

  async function submit() {
    if (!backend || !canSubmit) return;
    abort.current = new AbortController();
    setPhase({ name: "evaluating" });
    const outcome = await backend.evaluateChallenge(challenge, answer, abort.current.signal);
    if (outcome.kind === "ok") recordChallenge(recordFromResult(challenge, outcome.result, new Date().toISOString()));
    setPhase({ name: "done", outcome });
  }

  const outcome = phase.name === "done" ? phase.outcome : null;

  return (
    <article className="max-w-3xl mx-auto space-y-6">
      <header>
        <p className="text-sm font-semibold text-accent">
          Krátká výzva · {skillNames[challenge.skill]} · asi {challenge.minutes} minut
        </p>
        <h1 className="mt-1">{challenge.title}</h1>
      </header>

      <section aria-labelledby="situation-heading" className="card space-y-3">
        <h2 id="situation-heading">Situace</h2>
        <Markdown text={challenge.situation} />
      </section>

      <section aria-labelledby="ai-output-heading" className="card space-y-3 border-l-4 border-l-accent">
        <h2 id="ai-output-heading">Výstup AI</h2>
        <Markdown text={challenge.aiOutput} />
      </section>

      <section aria-labelledby="answer-heading" className="space-y-2">
        <h2 id="answer-heading">Úkol</h2>
        <p>{challenge.task}</p>
        {phase.name === "answering" ? (
          <>
            <label htmlFor="challenge-answer" className="sr-only">
              Tvoje odpověď
            </label>
            <textarea
              id="challenge-answer"
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              maxLength={maxAnswerChars}
              rows={8}
              placeholder="Tvoje odpověď…"
              className="w-full rounded-control border border-line bg-surface p-3 text-base"
            />
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={submit}
                disabled={!canSubmit}
                className="rl-submit-sweep rounded-full px-6 py-2.5 font-semibold disabled:opacity-50"
              >
                Odevzdat odpověď
              </button>
              <p className="text-sm text-ink-muted">
                {aiStatus !== "available"
                  ? "Hodnocení výzev běží jen v publikované stránce nebo na webu."
                  : trimmedLength < minAnswerChars
                    ? `Napiš aspoň ${minAnswerChars} znaků.`
                    : "Hodnocení obvykle trvá do půl minuty."}
              </p>
            </div>
          </>
        ) : (
          // Once submitted, the answer is what is being judged: shown as text, no longer editable.
          <div className="card space-y-2">
            <h3 className="text-base">Tvoje odpověď</h3>
            <p className="whitespace-pre-wrap">{answer.trim()}</p>
          </div>
        )}
        {phase.name === "evaluating" && (
          <p role="status" className="text-ink-muted">
            Hodnotím odpověď, obvykle to trvá do půl minuty…
          </p>
        )}
      </section>

      <div ref={resultRef} className="scroll-mt-6">
        {outcome?.kind === "ok" && <ChallengeResultView challenge={challenge} result={outcome.result} />}
        {outcome && outcome.kind !== "ok" && <OutcomeProblem outcome={outcome} onRetry={() => setPhase({ name: "answering" })} />}
      </div>

      <button type="button" onClick={onBack} className="rounded-full border border-line px-5 py-2">
        Všechny výzvy
      </button>
    </article>
  );
}

function OutcomeProblem({ outcome, onRetry }: { outcome: Exclude<ChallengeOutcome, { kind: "ok" }>; onRetry: () => void }) {
  const message =
    outcome.kind === "error"
      ? outcome.handling.message || "Hodnocení se přerušilo."
      : outcome.kind === "missing_key"
        ? "K této výzvě chybí klíč hodnotitele, takže ji teď nejde ohodnotit."
        : "Odpověď hodnotitele nešla použít. Zkus to prosím znovu.";
  const canRetry = outcome.kind === "invalid" || (outcome.kind === "error" && outcome.handling.offerRetry);
  return (
    <div role="alert" className="rounded-control bg-notice text-notice-ink p-4 space-y-2">
      <p>{message}</p>
      {canRetry && (
        <button type="button" onClick={onRetry} className="rounded-full border border-line px-4 py-1.5 font-semibold">
          Zkusit znovu
        </button>
      )}
    </div>
  );
}
