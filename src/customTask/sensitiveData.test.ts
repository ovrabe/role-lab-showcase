import { describe, expect, it } from "vitest";
import { findSensitiveData, hasBlockingData } from "./sensitiveData";
import { describeSummary, summarizeRows } from "./dataSummary";

const kinds = (text: string) => findSensitiveData(text).map((find) => `${find.kind}${find.blocking ? "" : "?"}`);

describe("findSensitiveData", () => {
  it("blocks e-mails, IBANs, account and birth numbers", () => {
    expect(kinds("Pište na jana.novakova@firma.cz.")).toEqual(["e-mail"]);
    expect(kinds("Účet CZ65 0800 0000 1920 0014 5399")).toEqual(["IBAN"]);
    expect(kinds("Platba na 19-2000145399/0800 a 2000145399/0800")).toEqual(["rodné číslo nebo číslo účtu", "rodné číslo nebo číslo účtu"]);
    expect(kinds("Pacient 850101/1234")).toEqual(["rodné číslo nebo číslo účtu"]);
    // 8551011216: month 55 (a woman in May), divisible by 11.
    expect(kinds("RČ 8551011216")).toEqual(["rodné číslo"]);
  });

  it("only warns about phone numbers, which look like other numbers", () => {
    expect(kinds("Volejte +420 601 123 456 nebo 601123456")).toEqual(["telefon?", "telefon?"]);
    expect(hasBlockingData("Objednávka 601123456")).toBe(false);
  });

  it("leaves ordinary numbers, dates and ten-digit codes alone", () => {
    expect(kinds("Prodej 4 100 ks za 12/2026, marže 35 %, období 2026-09 až 2026-11.")).toEqual([]);
    // Ten digits, but month 99: not a birth number.
    expect(kinds("EAN 1299123456")).toEqual([]);
    expect(kinds("")).toEqual([]);
  });

  it("finds nothing in a data summary made in the browser", () => {
    const summary = summarizeRows("prodeje.csv", [
      ["datum", "pobocka", "trzba", "zakaznik_email"],
      ["2026-09-01", "Praha", "125000", "a@b.cz"],
      ["2026-10-01", "Brno", "98000", "c@d.cz"],
    ]);
    expect(hasBlockingData(describeSummary(summary, new Set()))).toBe(false);
  });
});
