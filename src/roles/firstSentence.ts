/**
 * The first sentence of a task, shown on its card. A sentence ends with ".", "!" or "?" followed
 * by a capital letter or the end of the text, so a date like "2. 11." or "1. 2. 2027" in the
 * middle of a sentence does not cut it short.
 */
export function firstSentence(text: string): string {
  return text.match(/^.*?[.!?](?=\s+\p{Lu}|\s*$)/su)?.[0].trim() ?? text.trim();
}
