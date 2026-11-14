import { describe, expect, it } from "vitest";
import { parseCsv } from "./parseCsv";
import { getMaterialText } from "./materialFiles";
import { loadRoles } from "../roles/loadRoles";

describe("parseCsv", () => {
  it("reads a header and rows", () => {
    expect(parseCsv("sku,kusy\nARV-101,120\nVRD-208,95")).toEqual({
      header: ["sku", "kusy"],
      rows: [
        ["ARV-101", "120"],
        ["VRD-208", "95"],
      ],
    });
  });

  it("returns an empty table for an empty file or blank lines only", () => {
    expect(parseCsv("")).toEqual({ header: [], rows: [] });
    expect(parseCsv("\n\n  \n")).toEqual({ header: [], rows: [] });
  });

  it("reads quoted fields with commas, doubled quotes and line breaks", () => {
    const table = parseCsv('nazev,poznamka\n"Noir, EDP","Řekl ""ano""\na odešel"');
    expect(table.rows).toEqual([["Noir, EDP", 'Řekl "ano"\na odešel']]);
  });

  it("accepts Windows line breaks and a trailing line break", () => {
    expect(parseCsv("a,b\r\n1,2\r\n").rows).toEqual([["1", "2"]]);
  });

  it("skips blank lines between rows", () => {
    expect(parseCsv("a,b\n1,2\n\n3,4").rows).toEqual([
      ["1", "2"],
      ["3", "4"],
    ]);
  });

  it("pads a short row so columns never shift", () => {
    expect(parseCsv("a,b,c\n1").rows).toEqual([["1", "", ""]]);
  });

  it("keeps empty fields", () => {
    expect(parseCsv("a,b,c\n1,,3").rows).toEqual([["1", "", "3"]]);
  });

  it("reads every CSV material of every role with rows as wide as the header", () => {
    for (const role of loadRoles().activeRoles) {
      for (const material of role.materials.filter((candidate) => candidate.file.endsWith(".csv"))) {
        const table = parseCsv(getMaterialText(material.file)!);
        expect(table.header.length, material.file).toBeGreaterThan(1);
        expect(table.rows.length, material.file).toBeGreaterThan(0);
        for (const row of table.rows) expect(row.length, material.file).toBe(table.header.length);
      }
    }
  });
});
