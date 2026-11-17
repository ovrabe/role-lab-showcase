import { CircleAlert, CircleCheck, CircleDashed } from "lucide-react";
import type { StoredEvaluation } from "../evaluation/evaluationSchema";
import type { EvaluatorKey } from "../evaluation/evaluatorKeys";
import type { Citation } from "./citations";
import { CitationQuote } from "./CitationQuote";

// What was hidden in the data, shown on the result screen after submission (split out of
// ResultDetails.tsx to keep files short).
type TrapReviewProps = {
  evaluation: StoredEvaluation;
  keyData: EvaluatorKey | null;
  citations: Citation[];
  onSelectCitation: (citation: Citation) => void;
};

const trapStatusLabels = {
  caught: "Zachyceno",
  partial: "Zaznělo, ale dál se s tím nepracovalo",
  missed: "Nezachyceno",
} as const;

// Caught gets the data violet; partial and missed stay grey and neutral, never a warning colour.
const trapStatusIcons = { caught: CircleCheck, partial: CircleDashed, missed: CircleAlert } as const;

// Revealed only after submission: here the evaluation turns into learning, not judgement.
export function TrapReview({ evaluation, keyData, citations, onSelectCitation }: TrapReviewProps) {
  const { output } = evaluation;
  if (output.traps.length === 0) return null;
  return (
    <section aria-labelledby="traps-heading" className="space-y-5">
      <div>
        <h2 id="traps-heading">
          Co bylo v datech
        </h2>
        <p className="text-ink-muted">
          Podklady obsahovaly místa, která svádí k chybnému závěru. Tady je vidět, co v nich bylo.
        </p>
      </div>
      {output.traps.map((trap) => {
        const keyTrap = keyData?.traps.find((candidate) => candidate.id === trap.id);
        const naiveEffect = typeof keyTrap?.naiveEffect === "string" ? keyTrap.naiveEffect : null;
        return (
          <article key={trap.id} className="card space-y-2">
            <div className="flex items-start gap-3">
              <TrapStatusIcon status={trap.status} />
              <div className="min-w-0">
                <h3>{keyTrap?.title ?? trap.id}</h3>
                <p className="mt-1 inline-flex rounded-full bg-paper px-3 py-0.5 text-sm font-semibold text-ink-muted">
                  {trapStatusLabels[trap.status]}
                </p>
              </div>
            </div>
            {keyTrap && <p>{keyTrap.whatIsWrong}</p>}
            {naiveEffect && <p className="text-ink-muted">Proč na tom záleží: {naiveEffect}</p>}
            {trap.note && <p>{trap.note}</p>}
            <ul className="space-y-1">
              {citations
                .filter((citation) => citation.id.startsWith(`trap-${trap.id}-`))
                .map((citation) => (
                  <li key={citation.id}>
                    <CitationQuote citation={citation} onSelect={onSelectCitation} />
                  </li>
                ))}
            </ul>
          </article>
        );
      })}
    </section>
  );
}

export function TrapStatusIcon({ status }: { status: keyof typeof trapStatusIcons }) {
  const Icon = trapStatusIcons[status];
  return (
    <span
      aria-hidden="true"
      className={`shrink-0 grid place-items-center size-9 rounded-full ${
        status === "caught" ? "bg-[color-mix(in_srgb,var(--color-progress)_14%,transparent)] text-progress" : "bg-paper text-ink-muted"
      }`}
    >
      <Icon size={18} strokeWidth={2} />
    </span>
  );
}
