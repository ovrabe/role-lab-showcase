// A quote from the evaluator counts as verified only if it really appears in the
// cited place. Only words and numbers are compared: case, whitespace, punctuation
// and Markdown marks (list dashes, asterisks, backticks) carry no meaning here.
// The words must still match exactly and in order, so a paraphrase is caught.

// Letters, digits and % are content; everything else becomes a single space.
export function normalizeForQuotes(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}%]+/gu, " ")
    .trim();
}

// Split before normalizing: normalizing would erase the ellipsis itself.
export function quoteParts(quote: string): string[] {
  return quote
    .split(/…|\.\.\./)
    .map(normalizeForQuotes)
    .filter((part) => part !== "");
}

/**
 * True when `quote` appears in `source` as whole words. A quote shortened with an ellipsis
 * ("…" or "...") is verified when all its parts appear in that order.
 * Whole words, because "10 %" must not be found in "110 %", nor "kontrol" in "nekontroloval".
 */
export function quoteAppearsIn(quote: string, source: string): boolean {
  // Spaces around both sides make every match start and end on a word boundary.
  const normalizedSource = ` ${normalizeForQuotes(source)} `;
  const parts = quoteParts(quote);
  if (parts.length === 0) return false;

  let searchFrom = 0;
  for (const part of parts) {
    const index = normalizedSource.indexOf(` ${part} `, searchFrom);
    if (index < 0) return false;
    // Continue from the space after this part, so the next part may start right there.
    searchFrom = index + part.length + 1;
  }
  return true;
}
