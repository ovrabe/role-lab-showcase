import { useMemo, useState } from "react";
import type { DimensionId, RoleConfig } from "../roles/roleSchema";
import type { ReviewerReview, TaskSession } from "../session/sessionSchema";
import { computeLevel } from "../evaluation/computeLevel";
import { getEvaluatorKey } from "../evaluation/evaluatorKeys";
import { collectCitations, type Citation } from "./citations";
import { LevelSummary, ReviewNotes } from "./ResultSummary";
import { DimensionList } from "./ResultDetails";
import { TrapReview } from "./TrapReview";
import { GrowthSection } from "./GrowthSection";
import { PromptTips } from "./PromptTips";
import { StrongExampleSection, canShowStrongExample } from "./StrongExampleSection";
import { isCustomTask } from "../customTask/customTaskRole";
import { ReviewerPanel } from "./ReviewerPanel";
import { TranscriptView } from "./TranscriptView";
import { SaveFileButton } from "../components/SaveFileButton";
import { ResultCardButton } from "./ResultCardButton";
import { buildExport, exportFilename } from "./buildExport";
import { ResultProgress } from "../progress/ResultProgress";
import { EvaluationFeedback } from "./EvaluationFeedback";
import { isWebBuild } from "../buildFlags";
import type { WhyControls } from "./WhyScore";

type ResultScreenProps = {
  role: RoleConfig;
  session: TaskSession;
  // Stores the reviewer's adjustments with the attempt. Without it (the preview sample)
  // adjustments live in memory only: a sample is not the viewer's own work.
  onReviewChange?: (review: ReviewerReview | null) => void;
  // "Proč tohle skóre?" (WhyScore.tsx): passed only for the person's own result with Claude available.
  why?: WhyControls;
};

/**
 * The result: level, five dimensions with quotes, what was in the data, next steps.
 * On a wide screen the record of the work sits beside it, so a clicked quote
 * shows up in context right away; on a phone the record follows below.
 */
export function ResultScreen({ role, session, onReviewChange, why }: ResultScreenProps) {
  const evaluation = session.evaluation!;
  // Each click gets its own number, so clicking the same quote again still scrolls to it.
  const [selection, setSelection] = useState<{ citation: Citation; clickNumber: number } | null>(null);
  const selectCitation = (citation: Citation) =>
    setSelection((current) => ({ citation, clickNumber: (current?.clickNumber ?? 0) + 1 }));
  const [isReviewerMode, setIsReviewerMode] = useState(false);
  const [localReview, setLocalReview] = useState<ReviewerReview | null>(null);
  // The key is shown only now, after submission, to explain the traps. The web build has
  // no key in the page; its server sends the trap explanations with the evaluation.
  const keyData = useMemo(
    () => (evaluation.keyTraps ? { roleId: role.id, traps: evaluation.keyTraps } : getEvaluatorKey(role.id)),
    [role.id, evaluation.keyTraps],
  );
  const citations = useMemo(() => collectCitations(role, evaluation, keyData), [role, evaluation, keyData]);

  const aiScores = Object.fromEntries(
    evaluation.output.dimensions.map((dimension) => [dimension.id, dimension.score]),
  ) as Record<DimensionId, number>;
  const aiLevel = computeLevel(role, aiScores);
  const review = onReviewChange ? (session.review ?? null) : localReview;
  const scoresChanged = review !== null && role.rubric.some((dimension) => review.scores[dimension.id] !== aiScores[dimension.id]);
  // The same function computes the level for the AI proposal and for the reviewer's scores.
  const level = scoresChanged ? computeLevel(role, review.scores) : aiLevel;

  function updateReview(change: { scores?: Record<DimensionId, number>; note?: string }) {
    const base = review ?? { scores: aiScores, note: "", updatedAt: "" };
    const next = { ...base, ...change, updatedAt: new Date().toISOString() };
    const isSameAsAi = role.rubric.every((dimension) => next.scores[dimension.id] === aiScores[dimension.id]);
    // Nothing changed against the AI proposal: no review to keep.
    const result = isSameAsAi && next.note.trim() === "" ? null : next;
    if (onReviewChange) onReviewChange(result);
    else setLocalReview(result);
  }

  const detailsProps = { role, evaluation, citations, onSelectCitation: selectCitation };

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="min-w-0 space-y-8">
        <LevelSummary role={role} level={level} summary={evaluation.output.summary} aiLevel={scoresChanged ? aiLevel : undefined} />
        {/* Only the person's own attempt (samples have no onReviewChange) has progress. */}
        {onReviewChange && <ResultProgress role={role} evaluation={evaluation} />}
        <DimensionList
          {...detailsProps}
          reviewScores={review?.scores ?? null}
          isReviewerMode={isReviewerMode}
          why={why}
          onScoreChange={(dimensionId, score) =>
            updateReview({ scores: { ...(review?.scores ?? aiScores), [dimensionId]: score } })
          }
        />
        <TrapReview {...detailsProps} keyData={keyData} />
        <GrowthSection role={role} evaluation={evaluation} />
        <PromptTips role={role} evaluation={evaluation} />
        {/* Only beside the person's own result: a sample already is a made-up attempt. */}
        {onReviewChange && canShowStrongExample && !isCustomTask(role) && <StrongExampleSection role={role} />}
        <ReviewNotes evaluation={evaluation} />
        {/* Web version only (it needs the project's server), and only for the person's own attempt. */}
        {isWebBuild && onReviewChange && <EvaluationFeedback role={role} evaluation={evaluation} />}
        <ReviewerPanel
          review={review}
          isReviewerMode={isReviewerMode}
          aiLevel={aiLevel}
          onNoteChange={(note) => updateReview({ note })}
          onReset={() => updateReview({ scores: aiScores, note: "" })}
        />
        {/* Footer of the result (docs/SPEC.md, section 4.4): export and reviewer mode. */}
        <div className="flex flex-wrap gap-3 items-start">
          <SaveFileButton
            label="Stáhnout výsledek (JSON)"
            filename={exportFilename(role, session)}
            getContent={() => buildExport(role, session, review)}
            className="rounded-full bg-action text-action-contrast px-[1.1rem] py-2 font-medium disabled:opacity-50"
          />
          <ResultCardButton role={role} evaluation={evaluation} level={level} />
          <button
            type="button"
            onClick={() => setIsReviewerMode((current) => !current)}
            aria-pressed={isReviewerMode}
            className="rounded-full border border-line bg-surface px-[1.1rem] py-2 aria-pressed:border-[var(--color-control-border)]"
          >
            {isReviewerMode ? "Zavřít režim hodnotitele" : "Otevřít v režimu hodnotitele"}
          </button>
        </div>
      </div>
      <aside aria-labelledby="record-heading" className="min-w-0">
        <div className="card lg:sticky lg:top-4">
          <h2 id="record-heading" className="mb-1">
            Záznam práce
          </h2>
          <p className="text-sm text-ink-muted mb-3">
            Zvýrazněná místa hodnotitel citoval. Kliknutím na citaci vlevo se sem záznam posune.
          </p>
          <div className="lg:max-h-[80vh] lg:overflow-y-auto lg:pr-2">
            <TranscriptView
              transcript={session.transcript}
              submission={session.submission}
              reflection={session.reflection}
              citations={citations}
              selection={selection}
            />
          </div>
        </div>
      </aside>
    </div>
  );
}
