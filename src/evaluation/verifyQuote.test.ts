import { describe, expect, it } from "vitest";
import { normalizeForQuotes, quoteAppearsIn, quoteParts } from "./verifyQuote";

const source = "Rozhodovat chci podle marže, trendu a zásoby. **Nechci** volit jen podle objemu (kusy).";

describe("quoteAppearsIn", () => {
  it("finds a verbatim quote", () => {
    expect(quoteAppearsIn("Rozhodovat chci podle marže, trendu a zásoby.", source)).toBe(true);
  });

  it("ignores case, extra spaces, punctuation and Markdown marks", () => {
    expect(quoteAppearsIn("rozhodovat   chci podle marže trendu", source)).toBe(true);
    expect(quoteAppearsIn("Nechci volit jen podle objemu", source)).toBe(true);
    expect(quoteAppearsIn("- nechci volit", "* **Nechci** volit")).toBe(true);
  });

  it("accepts a quote shortened with an ellipsis when the parts come in order", () => {
    expect(quoteAppearsIn("Rozhodovat chci … podle objemu", source)).toBe(true);
    expect(quoteAppearsIn("Rozhodovat chci ... podle objemu", source)).toBe(true);
  });

  it("rejects ellipsis parts in the wrong order", () => {
    expect(quoteAppearsIn("podle objemu … Rozhodovat chci", source)).toBe(false);
  });

  it("rejects a paraphrase and a made-up quote", () => {
    expect(quoteAppearsIn("Rozhodovat budu podle marže", source)).toBe(false);
    expect(quoteAppearsIn("Doporučuji ARV-114", source)).toBe(false);
  });

  it("keeps Czech diacritics meaningful", () => {
    expect(quoteAppearsIn("marze", source)).toBe(false);
  });

  it("keeps numbers and percent signs meaningful", () => {
    const numbers = "Marže klesla z 53,9 % na 38,0 %.";
    expect(quoteAppearsIn("z 53,9 % na 38,0 %", numbers)).toBe(true);
    expect(quoteAppearsIn("z 53,9 % na 38,1 %", numbers)).toBe(false);
  });

  it("rejects an empty quote or a quote of punctuation only", () => {
    expect(quoteAppearsIn("", source)).toBe(false);
    expect(quoteAppearsIn("…", source)).toBe(false);
    expect(quoteAppearsIn(" , . ", source)).toBe(false);
  });

  it("finds nothing in an empty source", () => {
    expect(quoteAppearsIn("cokoli", "")).toBe(false);
  });

  it("handles a long source", () => {
    const long = `${"výplň ".repeat(20000)}hledaná věta na konci`;
    expect(quoteAppearsIn("hledaná věta na konci", long)).toBe(true);
  });
});

describe("normalizeForQuotes and quoteParts", () => {
  it("keeps letters, digits and %, collapses the rest to single spaces", () => {
    expect(normalizeForQuotes("  Ahoj, SVĚTE!  50 %  ")).toBe("ahoj světe 50 %");
  });

  it("splits a quote on both ellipsis forms and drops empty parts", () => {
    expect(quoteParts("A … B ... C …")).toEqual(["a", "b", "c"]);
  });
});
