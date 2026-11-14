import { useEffect, type ReactNode } from "react";
import type { TranscriptItem } from "../session/sessionSchema";
import { findQuoteRange, mergeRanges, type TextRange } from "../evaluation/quoteRange";
import type { Citation } from "./citations";
import type { EvidencePlace } from "../evaluation/evaluationSchema";
import { AiIcon } from "../components/AiIcon";
import { Markdown } from "../components/Markdown";

type TranscriptViewProps = {
  transcript: TranscriptItem[];
  submission: string;
  reflection: string;
  citations: Citation[];
  selection: { citation: Citation; clickNumber: number } | null;
};

const kindLabels: Record<TranscriptItem["kind"], string> = { user: "Ty", assistant: "Asistent", event: "Událost" };

export const recordElementId = (turn: EvidencePlace) => `record-${turn}`;

/**
 * The full record of the work. Every cited passage is highlighted like a marker,
 * with the dimension it supports written in the margin. An assistant answer with a
 * cited passage is shown as plain text, so the highlight lands exactly on the cited
 * characters; one without is formatted like in the chat.
 */
export function TranscriptView({ transcript, submission, reflection, citations, selection }: TranscriptViewProps) {
  const selectedCitation = selection?.citation ?? null;

  // Runs on every click, including a repeated click on the same quote.
  useEffect(() => {
    if (!selection) return;
    const element = document.getElementById(recordElementId(selection.citation.turn));
    if (!element) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    element.scrollIntoView({ block: "center", behavior: reduceMotion ? "auto" : "smooth" });
    element.focus({ preventScroll: true });
  }, [selection]);

  type EntryKind = TranscriptItem["kind"] | "written";
  const entries: { turn: EvidencePlace; label: string; content: string; kind: EntryKind }[] = [
    ...transcript.map((item) => ({
      turn: item.turn,
      label: kindLabels[item.kind],
      content: item.content,
      kind: item.kind,
    })),
    { turn: "submission", label: "Odevzdání", content: submission, kind: "written" as const },
    // The optional process comment is part of the record too: the evaluator may cite it.
    ...(reflection.trim() !== ""
      ? [{ turn: "reflection" as const, label: "Komentář k postupu", content: reflection, kind: "written" as const }]
      : []),
  ];

  return (
    <ol className="space-y-2 leading-normal">
      {entries.map((entry) => {
        const cited = citations.filter((citation) => citation.turn === entry.turn);
        const isSelected = selectedCitation?.turn === entry.turn;
        const marginLabels = [...new Set(cited.filter((citation) => citation.verified).map((citation) => citation.label))];
        return (
          // Laid out like the chat: the person on the right in a light bubble, the assistant on
          // the left as plain text, events as small centred notes, the written result as a block.
          // The text itself stays plain, so a highlight lands exactly on the cited characters.
          <li
            key={String(entry.turn)}
            id={recordElementId(entry.turn)}
            tabIndex={-1}
            className={`flex flex-col rounded-control p-1.5 ${entry.kind === "user" ? "items-end" : entry.kind === "event" ? "items-center" : "items-start"} ${
              isSelected ? "ring-2 ring-accent" : ""
            }`}
          >
            <p className="flex items-center gap-1.5 text-xs font-semibold text-ink-muted mb-1">
              {entry.kind === "assistant" && <AiIcon size={12} />}
              {typeof entry.turn === "number" && <span className="tabular-nums font-normal">{entry.turn} ·</span>}
              {entry.label}
              {marginLabels.length > 0 && <span className="font-normal text-progress"> · cituje: {marginLabels.join(", ")}</span>}
            </p>
            {entry.kind === "assistant" && !hasHighlight(entry.content, cited) ? (
              // Nothing cited here, so it can look like the chat: tables, bold, lists.
              <div className="w-full break-words">
                <Markdown text={entry.content} />
              </div>
            ) : (
            <p
              className={`whitespace-pre-wrap break-words ${
                entry.kind === "user"
                  ? "max-w-[90%] rounded-card rounded-br-md bg-paper px-4 py-2.5"
                  : entry.kind === "event"
                    ? "rounded-full bg-paper px-3 py-1 text-sm text-ink-muted text-center"
                    : entry.kind === "written"
                      ? "w-full rounded-control border border-line px-4 py-3"
                      : ""
              }`}
            >
              {highlight(entry.content, cited, isSelected ? selectedCitation : null, entry.kind === "assistant" ? hideBoldMarkers : keepText)}
            </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function highlightRanges(content: string, cited: Citation[]): TextRange[] {
  return cited
    .filter((citation) => citation.verified)
    .map((citation) => findQuoteRange(content, citation.quote))
    .filter((range): range is TextRange => range !== null);
}

const hasHighlight = (content: string, cited: Citation[]) => highlightRanges(content, cited).length > 0;

const keepText = (text: string) => text;
// Highlights are found in the raw text first; only then are the ** markers dropped from
// each piece, so a highlight still covers exactly the cited words.
const hideBoldMarkers = (text: string) => text.replaceAll("**", "");

function highlight(content: string, cited: Citation[], selected: Citation | null, clean: (text: string) => string): ReactNode {
  const ranges = highlightRanges(content, cited);
  if (ranges.length === 0) return clean(content);

  const selectedRange = selected ? findQuoteRange(content, selected.quote) : null;
  const parts: ReactNode[] = [];
  let position = 0;
  for (const range of mergeRanges(ranges)) {
    if (range.start > position) parts.push(clean(content.slice(position, range.start)));
    const containsSelected = selectedRange && selectedRange.start >= range.start && selectedRange.end <= range.end;
    parts.push(
      <mark key={range.start} className={`marker ${containsSelected ?"marker-selected" : ""}`}>
        {clean(content.slice(range.start, range.end))}
      </mark>,
    );
    position = range.end;
  }
  if (position < content.length) parts.push(clean(content.slice(position)));
  return parts;
}
