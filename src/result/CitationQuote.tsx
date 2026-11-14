import type { Citation } from "./citations";
import { describeEvidencePlace } from "../evaluation/evaluationSchema";

// A quote in the result. Clicking it moves the transcript to the cited turn.
export function CitationQuote({ citation, onSelect }: { citation: Citation; onSelect: (citation: Citation) => void }) {
  const place = describeEvidencePlace(citation.turn);
  return (
    <button
      type="button"
      onClick={() => onSelect(citation)}
      className="text-left group"
      aria-label={`Citace z místa ${place}: ${citation.quote}. Ukázat v záznamu.`}
    >
      {citation.verified ? (
        <span className="marker">„{citation.quote}“</span>
      ) : (
        <span className="underline decoration-dashed underline-offset-4">„{citation.quote}“</span>
      )}{" "}
      <span className="text-xs text-ink-muted whitespace-nowrap group-hover:underline">
        {place}
        {!citation.verified && ", neověřená citace"}
      </span>
    </button>
  );
}
