import type { ReviewerReview } from "../session/sessionSchema";
import type { LevelResult } from "../evaluation/computeLevel";

type ReviewerPanelProps = {
  review: ReviewerReview | null;
  isReviewerMode: boolean;
  aiLevel: LevelResult;
  onNoteChange: (note: string) => void;
  onReset: () => void;
};

const formatAverage = (value: number) => value.toFixed(1).replace(".", ",");

// The human has the final word (docs/SPEC.md, section 1): the reviewer's note and a way
// back to the AI proposal. Outside reviewer mode only the note is shown, read-only.
export function ReviewerPanel({ review, isReviewerMode, aiLevel, onNoteChange, onReset }: ReviewerPanelProps) {
  if (!isReviewerMode) {
    if (!review?.note.trim()) return null;
    return (
      <section aria-labelledby="reviewer-note-heading" className="card space-y-2">
        <h2 id="reviewer-note-heading">
          Poznámka hodnotitele
        </h2>
        <p className="whitespace-pre-wrap rounded-control bg-paper px-4 py-3">{review.note}</p>
      </section>
    );
  }

  return (
    <section aria-labelledby="reviewer-heading" className="card space-y-3">
      <h2 id="reviewer-heading">
        Režim hodnotitele
      </h2>
      <p className="text-ink-muted">
        Skóre jednotlivých oblastí změníš výše. Úroveň se přepočítá stejnými pravidly jako u AI. Návrh AI zůstává
        uložený: úroveň {aiLevel.level} „{aiLevel.label}“, průměr {formatAverage(aiLevel.average)}.
      </p>
      <label htmlFor="reviewer-note" className="block font-semibold">
        Poznámka hodnotitele
      </label>
      <textarea
        id="reviewer-note"
        value={review?.note ?? ""}
        onChange={(event) => onNoteChange(event.target.value)}
        rows={4}
        className="w-full rounded-control border border-line bg-surface p-3 text-base"
      />
      {review && (
        <button type="button" onClick={onReset} className="text-sm underline underline-offset-4 text-ink-muted">
          Zrušit úpravy a vrátit návrh AI
        </button>
      )}
    </section>
  );
}
