// Characters that show nothing but can hide inside a word: soft hyphen, zero-width spaces and
// joiners, direction marks, Mongolian vowel separator, invisible operators, tag characters.
// The evaluator's prompt drops them (src/prompts/evaluator.ts), so a look-alike tag cannot hide
// behind one; quote checks drop the same ones (src/evaluation/verifyQuote.ts, quoteRange.ts), or
// an honest quote of text pasted from the web or Word would fail.
export const invisibleCharacters = /[\u00AD\u034F\u061C\u180B-\u180F\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u206F\uFEFF\u{E0000}-\u{E007F}]/gu;

export const withoutInvisible = (text: string) => text.replace(invisibleCharacters, "");
