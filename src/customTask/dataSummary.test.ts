import { describe, expect, it } from "vitest";
import { utils, write } from "xlsx";
import { describeSummary, limits, roughly, summarizeFile, summarizeRows } from "./dataSummary";

const table = [
  ["Produkt", "Prodáno ks", "Tržby Kč", "Datum", "Skladem", "Poznámka"],
  ["Mikina Nordic", "120", "358 800", "2. 11. 2026", "ano", "Tajný zákazník Novák"],
  ["Bunda Arctic", "45", "224 550", "2026-11-09", "ne", ""],
  ["Mikina Nordic", "98", "293 020", "16.11.2026", "ano", "VIP odběratel"],
];

describe("summarizeRows", () => {
  const summary = summarizeRows("prodeje.csv", table);

  it("recognises types and counts rows", () => {
    expect(summary.rows).toBe(3);
    expect(summary.columns.map((column) => column.type)).toEqual(["text", "číslo", "číslo", "datum", "ano/ne", "text"]);
  });

  it("never carries a value from a text column, only how many different values there are", () => {
    const text = JSON.stringify(summary) + describeSummary(summary, new Set());
    for (const secret of ["Mikina Nordic", "Bunda Arctic", "Novák", "VIP odběratel"]) expect(text).not.toContain(secret);
    expect(summary.columns[0]).toMatchObject({ distinct: 2 });
    expect(summary.columns[5]).toMatchObject({ distinct: 2, empty: 1 });
  });

  it("rounds numbers to two significant digits and dates to months", () => {
    expect(summary.columns[2]).toMatchObject({ min: 220000, max: 360000 });
    expect(summary.columns[3]).toMatchObject({ from: "2026-11", to: "2026-11" });
    expect(roughly(358800)).toBe(360000);
    expect(roughly(-0.0347)).toBe(-0.035);
    expect(roughly(0)).toBe(0);
  });

  it("writes Czech plurals and spaces in thousands", () => {
    const text = describeSummary(summary, new Set());
    expect(text).toContain("3 řádky");
    expect(text).toContain("2 různé hodnoty");
    expect(text).toContain("zhruba od 220\u00a0000 do 360\u00a0000");
  });

  it("leaves out the columns the person unticks", () => {
    const text = describeSummary(summary, new Set(["Poznámka", "Tržby Kč"]));
    expect(text).not.toContain("Poznámka");
    expect(text).not.toContain("Tržby");
    expect(text).toContain("Prodáno ks: číslo");
  });

  it("copes with an empty header cell, too many columns and long names", () => {
    const wide = [Array.from({ length: 40 }, (_, index) => (index === 0 ? "" : "x".repeat(100))), Array.from({ length: 40 }, () => "1")];
    const result = summarizeRows("wide.csv", wide);
    expect(result.columns).toHaveLength(limits.columns);
    expect(result.columns[0].name).toBe("Sloupec 1");
    expect(result.columns[1].name).toHaveLength(limits.nameLength);
  });
});

describe("summarizeFile", () => {
  const asFile = (data: ArrayBuffer | string, name: string) => new File([data], name);

  it("reads an Excel file the same way as a CSV", async () => {
    const book = utils.book_new();
    utils.book_append_sheet(book, utils.aoa_to_sheet(table), "List1");
    const buffer = write(book, { type: "array", bookType: "xlsx" });
    const summary = await summarizeFile(asFile(buffer, "prodeje.xlsx"));
    expect(summary.rows).toBe(3);
    expect(summary.columns.map((column) => column.name)).toEqual(table[0]);
  });

  it("reads a CSV with Czech characters", async () => {
    const summary = await summarizeFile(asFile("Středisko;Částka\nVýroba;1200\nSklad;800\n", "naklady.csv"));
    expect(summary.columns.map((column) => column.name)).toEqual(["Středisko", "Částka"]);
    expect(summary.columns[1].type).toBe("číslo");
  });

  it("reads a CSV saved by Czech Excel in windows-1250", async () => {
    // "Středisko;Částka" in windows-1250: ř = 0xF8, Č = 0xC8, á = 0xE1.
    const bytes = new Uint8Array([0x53, 0x74, 0xf8, 0x65, 0x64, 0x69, 0x73, 0x6b, 0x6f, 0x3b, 0xc8, 0xe1, 0x73, 0x74, 0x6b, 0x61, 0x0a, 0x41, 0x3b, 0x31, 0x0a]);
    const summary = await summarizeFile(asFile(bytes.buffer, "export.csv"));
    expect(summary.columns.map((column) => column.name)).toEqual(["Středisko", "Částka"]);
  });

  it("rejects an empty table and a file over the size limit", async () => {
    await expect(summarizeFile(asFile("Jen záhlaví\n", "a.csv"))).rejects.toThrow("prázdná");
    const big = { size: limits.fileBytes + 1, name: "big.csv", arrayBuffer: async () => new ArrayBuffer(0) } as unknown as File;
    await expect(summarizeFile(big)).rejects.toThrow("10 MB");
  });
});
