import { TrapStatusIcon } from "../result/ResultDetails";
import type { ChallengeResult } from "./challengeResult";
import type { ChallengeConfig } from "./challengeSchema";

// Neutral wording: the person may be anyone. "partial" means the answer pointed the right
// way without naming the problem.
const trapStatusLabels = {
  caught: "Zachyceno",
  partial: "Naznačeno, ale nepojmenováno",
  missed: "Nezachyceno",
} as const;

/** The result of one challenge: score with its rubric line, quotes, what was hidden, a tip. */
export function ChallengeResultView({ challenge, result }: { challenge: ChallengeConfig; result: ChallengeResult }) {
  return (
    <div className="space-y-6">
      <section aria-labelledby="challenge-score-heading" className="card space-y-3">
        <h2 id="challenge-score-heading" className="flex items-baseline gap-3">
          Hodnocení
          <span className="text-3xl font-semibold tabular-nums text-accent">
            {result.score}
            <span className="text-lg text-ink-muted"> / 4</span>
          </span>
        </h2>
        <p className="text-ink-muted">{challenge.rubric[String(result.score) as "1" | "2" | "3" | "4"]}</p>
        <p>{result.rationale}</p>
        {result.evidence.length > 0 && (
          <ul className="space-y-1">
            {result.evidence.map((item) => (
              <li key={item.quote}>
                <Quote text={item.quote} verified={item.verified} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="challenge-traps-heading" className="space-y-4">
        <div>
          {/* Neutral for every skill: not every challenge is about errors in the AI's output. */}
          <h2 id="challenge-traps-heading">Co výzva skrývala</h2>
          <p className="text-ink-muted">Tohle měla dobrá odpověď zachytit.</p>
        </div>
        {result.traps.map((trap) => (
          <article key={trap.id} className="card space-y-2">
            <div className="flex items-start gap-3">
              <TrapStatusIcon status={trap.status} />
              <div className="min-w-0">
                <h3>{trap.title}</h3>
                <p className="mt-1 inline-flex rounded-full bg-paper px-3 py-0.5 text-sm font-semibold text-ink-muted">
                  {trapStatusLabels[trap.status]}
                </p>
              </div>
            </div>
            <p>{trap.whatIsWrong}</p>
            {trap.quote && <Quote text={trap.quote} verified={trap.quoteVerified} />}
          </article>
        ))}
      </section>

      {result.tip && (
        <section aria-labelledby="challenge-tip-heading" className="card space-y-2">
          <h2 id="challenge-tip-heading">Tip na příště</h2>
          <p>{result.tip}</p>
        </section>
      )}

      {result.humanReviewFlags.length > 0 && (
        <section aria-labelledby="challenge-flags-heading" className="rounded-control bg-notice text-notice-ink p-4 space-y-1">
          <h2 id="challenge-flags-heading" className="text-base">
            K ověření člověkem
          </h2>
          <ul className="list-disc pl-5">
            {result.humanReviewFlags.map((flag) => (
              <li key={flag}>{flag}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Quote({ text, verified }: { text: string; verified: boolean }) {
  return (
    <blockquote className="border-l-2 border-accent pl-3 text-ink-muted">
      „{text}“
      {!verified && <span className="ml-2 text-sm text-notice-ink">(citace v odpovědi není doslova)</span>}
    </blockquote>
  );
}
