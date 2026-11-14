import { quoteParts } from "./verifyQuote";

// Finds where a quote sits in the original text, so the result screen can
// highlight it. Compares words and numbers only, exactly like verifyQuote,
// but returns positions in the original text.

export type TextRange = { start: number; end: number };

// Normalized text plus, for every normalized character, its index in the original.
function normalizeWithMap(text: string): { normalized: string; originalIndex: number[] } {
  let normalized = "";
  const originalIndex: number[] = [];
  for (let index = 0; index < text.length; index++) {
    const isContent = /[\p{L}\p{N}%]/u.test(text[index]);
    const char = isContent ? text[index].toLowerCase() : " ";
    // Runs of non-content characters collapse into one space, as in verifyQuote.
    if (char === " " && (normalized === "" || normalized.endsWith(" "))) continue;
    normalized += char;
    originalIndex.push(index);
  }
  return { normalized, originalIndex };
}

/**
 * The range from the first to the last part of the quote (parts split by an
 * ellipsis), or null when the quote is not in the text.
 */
export function findQuoteRange(text: string, quote: string): TextRange | null {
  const { normalized, originalIndex } = normalizeWithMap(text);
  const parts = quoteParts(quote);
  if (parts.length === 0) return null;

  let searchFrom = 0;
  let start = -1;
  let end = -1;
  for (const part of parts) {
    const index = normalized.indexOf(part, searchFrom);
    if (index < 0) return null;
    if (start < 0) start = index;
    end = index + part.length;
    searchFrom = end;
  }
  return { start: originalIndex[start], end: originalIndex[end - 1] + 1 };
}

/** Sorted, non-overlapping ranges: overlapping highlights merge into one. */
export function mergeRanges(ranges: TextRange[]): TextRange[] {
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const merged: TextRange[] = [];
  for (const range of sorted) {
    const last = merged[merged.length - 1];
    if (last && range.start <= last.end) last.end = Math.max(last.end, range.end);
    else merged.push({ ...range });
  }
  return merged;
}
