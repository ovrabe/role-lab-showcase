import type { RoleConfig } from "../roles/roleSchema";
import type { StoredEvaluation } from "../evaluation/evaluationSchema";
import type { Citation } from "./citations";
import { CitationQuote } from "./CitationQuote";
import { WhyScore, type WhyControls } from "./WhyScore";

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
  // "Proč tohle skóre?": only for the person's own result with Claude available.
  why?: WhyControls;
};

export function DimensionList({
  role,
  evaluation,
  citations,
  onSelectCitation,
  reviewScores,
  isReviewerMode,
  onScoreChange,
  why,
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
            {why && <WhyScore dimensionId={dimension.id} why={why} />}
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
