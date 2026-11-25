import { quoteParts } from "./verifyQuote";
import { invisibleCharacters } from "../text/invisibleCharacters.js";

// Finds where a quote sits in the original text, so the result screen can
// highlight it. Compares words and numbers only, exactly like verifyQuote,
// but returns positions in the original text.

export type TextRange = { start: number; end: number };

// Normalized text plus, for every normalized character, where it starts and ends in the original
// (the end matters for a character beyond U+FFFF, two UTF-16 units: a highlight must not split it).
function normalizeWithMap(text: string): { normalized: string; originalIndex: number[]; originalEnd: number[] } {
  let normalized = "";
  const originalIndex: number[] = [];
  const originalEnd: number[] = [];
  let lastWasSpace = false;
  // Whole characters, not UTF-16 halves: a character beyond U+FFFF (an invisible tag character,
  // a rare letter) is one unit for the checks, as in verifyQuote.
  for (let index = 0; index < text.length; ) {
    const whole = String.fromCodePoint(text.codePointAt(index) ?? 0);
    const start = index;
    index += whole.length;
    // Invisible characters vanish, as in verifyQuote (src/text/invisibleCharacters.ts).
    invisibleCharacters.lastIndex = 0;
    if (invisibleCharacters.test(whole)) continue;
    const isContent = /[\p{L}\p{N}%]/u.test(whole);
    const char = isContent ? whole.toLowerCase() : " ";
    // Runs of non-content characters collapse into one space, as in verifyQuote.
    // A flag, not a look at the string built so far: reading it each time made long texts slow.
    if (char === " " && (normalized === "" || lastWasSpace)) continue;
    lastWasSpace = char === " ";
    normalized += char;
    for (let unit = 0; unit < char.length; unit++) {
      originalIndex.push(start);
      originalEnd.push(index);
    }
  }
  return { normalized, originalIndex, originalEnd };
}

/**
 * The range from the first to the last part of the quote (parts split by an
 * ellipsis), or null when the quote is not in the text.
 */
export function findQuoteRange(text: string, quote: string): TextRange | null {
  const { normalized, originalIndex, originalEnd } = normalizeWithMap(text);
  // Whole words, as in verifyQuote: "kontrol" must not be found inside "nekontroloval".
  const padded = ` ${normalized} `;
  const parts = quoteParts(quote);
  if (parts.length === 0) return null;

  let searchFrom = 0;
  let start = -1;
  let end = -1;
  for (const part of parts) {
    const found = padded.indexOf(` ${part} `, searchFrom);
    if (found < 0) return null;
    // `found` points at the space before the part; in `normalized` the part starts there.
    const index = found;
    if (start < 0) start = index;
    end = index + part.length;
    searchFrom = end;
  }
  return { start: originalIndex[start], end: originalEnd[end - 1] };
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
