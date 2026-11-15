import { CircleAlert, CircleCheck, CircleDashed, Lightbulb, Sparkles } from "lucide-react";
import type { RoleConfig } from "../roles/roleSchema";
import type { StoredEvaluation } from "../evaluation/evaluationSchema";
import type { EvaluatorKey } from "../evaluation/evaluatorKeys";
import type { Citation } from "./citations";
import { CitationQuote } from "./CitationQuote";

type DetailsProps = {
  role: RoleConfig;
  evaluation: StoredEvaluation;
  citations: Citation[];
  onSelectCitation: (citation: Citation) => void;
};

const dimensionName = (role: RoleConfig, id: string) =>
  role.rubric.find((dimension) => dimension.id === id)?.name ?? id;

type ReviewProps = {
  // Scores as the reviewer set them, or null when nobody adjusted the AI proposal.
  reviewScores: Record<string, number> | null;
  isReviewerMode: boolean;
  onScoreChange: (dimensionId: string, score: number) => void;
};

export function DimensionList({
  role,
  evaluation,
  citations,
  onSelectCitation,
  reviewScores,
  isReviewerMode,
  onScoreChange,
}: DetailsProps & ReviewProps) {
  const { output } = evaluation;
  return (
    <section aria-labelledby="dimensions-heading" className="space-y-4">
      <h2 id="dimensions-heading">
        Pět oblastí
      </h2>
      <DimensionOverview role={role} evaluation={evaluation} reviewScores={reviewScores} />
      {output.dimensions.map((dimension) => {
        const rubric = role.rubric.find((rubricDimension) => rubricDimension.id === dimension.id);
        const ownCitations = citations.filter((citation) => citation.id.startsWith(`dimension-${dimension.id}-`));
        const noEvidence = output.insufficientEvidence.includes(dimension.id);
        const score = reviewScores?.[dimension.id] ?? dimension.score;
        const isChanged = score !== dimension.score;
        return (
          <article key={dimension.id} aria-labelledby={`dimension-${dimension.id}`} className="card space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 id={`dimension-${dimension.id}`}>
                {rubric?.name}
              </h3>
              {isReviewerMode ? (
                <label className="flex items-center gap-2 text-sm">
                  <span className="text-ink-muted">AI navrhla {dimension.score}, skóre:</span>
                  <select
                    value={score}
                    onChange={(event) => onScoreChange(dimension.id, Number(event.target.value))}
                    className="rl-select tabular-nums"
                  >
                    {[1, 2, 3, 4].map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <ScoreMarks score={score} />
              )}
            </div>
            {isChanged && (
              <p className="text-sm font-semibold text-accent">
                Upraveno hodnotitelem: AI navrhla {dimension.score}, hodnotitel {score}.
              </p>
            )}
            {rubric && (
              <p className="flex gap-2.5 text-sm text-ink-muted">
                <span className="font-semibold text-progress tabular-nums">{score}</span>
                <span>{rubric.anchors[String(score) as "1"]}</span>
              </p>
            )}
            <p>{dimension.rationale}</p>
            {noEvidence && <p className="text-sm text-ink-muted">Nedostatek podkladů pro jisté hodnocení.</p>}
            <ul className="space-y-1">
              {ownCitations.map((citation) => (
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

// The five scores at a glance: one bar each in the data gradient. Every bar carries the
// same gradient and only its length differs, so colour never reads as good or bad.
function DimensionOverview({
  role,
  evaluation,
  reviewScores,
}: {
  role: RoleConfig;
  evaluation: StoredEvaluation;
  reviewScores: Record<string, number> | null;
}) {
  return (
    <div className="card">
      <ul className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_1.25rem] items-center gap-x-4 gap-y-3">
        {evaluation.output.dimensions.map((dimension) => {
          const score = reviewScores?.[dimension.id] ?? dimension.score;
          return (
            <li key={dimension.id} className="contents">
              <span className="text-sm truncate">{dimensionName(role, dimension.id)}</span>
              <span className="h-1.5 rounded-full bg-track overflow-hidden" aria-hidden="true">
                <span
                  className="rl-bar-in block h-full rounded-full bg-[image:var(--progress-sweep)]"
                  style={{ width: `${(score / 4) * 100}%` }}
                />
              </span>
              <span className="text-sm font-semibold tabular-nums text-right">
                {score}
                <span className="sr-only"> ze 4</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ScoreMarks({ score }: { score: number }) {
  return (
    <span className="flex items-center gap-2 text-sm" aria-label={`Skóre ${score} ze 4`}>
      <span className="flex gap-1" aria-hidden="true">
        {[1, 2, 3, 4].map((step) => (
          <span key={step} className={`size-2 rounded-full ${step <= score ? "bg-progress" : "bg-track"}`} />
        ))}
      </span>
      <span className="tabular-nums text-ink-muted">{score}/4</span>
    </span>
  );
}

// Neutral wording: the person may be anyone.
const trapStatusLabels = {
  caught: "Zachyceno",
  partial: "Zaznělo, ale dál se s tím nepracovalo",
  missed: "Nezachyceno",
} as const;

// Caught gets the data violet; partial and missed stay grey and neutral, never a warning colour.
const trapStatusIcons = { caught: CircleCheck, partial: CircleDashed, missed: CircleAlert } as const;

// Revealed only after submission: here the evaluation turns into learning, not judgement.
export function TrapReview({ evaluation, keyData, citations, onSelectCitation }: DetailsProps & { keyData: EvaluatorKey | null }) {
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

export function GrowthSection({ role, evaluation }: { role: RoleConfig; evaluation: StoredEvaluation }) {
  const { strengths, nextSteps } = evaluation.output;
  return (
    <section aria-labelledby="growth-heading" className="card space-y-4">
      <h2 id="growth-heading">
        Co ti jde a co zkusit příště
      </h2>
      {strengths.length > 0 && (
        <ul className="space-y-2">
          {strengths.map((strength) => (
            <li key={strength} className="flex gap-3">
              <Sparkles aria-hidden="true" size={18} className="shrink-0 mt-0.5 text-progress" />
              <span>{strength}</span>
            </li>
          ))}
        </ul>
      )}
      {/* Next steps as tiles with an icon, like the brief in the task. */}
      {nextSteps.map((step) => (
        <article key={`${step.dimension}-${step.title}`} className="rounded-control bg-paper p-4 flex gap-3">
          <span
            aria-hidden="true"
            className="shrink-0 grid place-items-center size-9 rounded-full bg-[color-mix(in_srgb,var(--color-progress)_14%,transparent)] text-progress"
          >
            <Lightbulb size={18} strokeWidth={2} />
          </span>
          <div className="min-w-0 space-y-1">
            <h3>{step.title}</h3>
            <p className="text-sm text-ink-muted">{dimensionName(role, step.dimension)}</p>
            <p>{step.why}</p>
            <p>
              <span className="font-semibold">Cvičení: </span>
              {step.exercise}
            </p>
          </div>
        </article>
      ))}
    </section>
  );
}
