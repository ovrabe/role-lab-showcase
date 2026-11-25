// What leaves the browser from a person's own table for "Vlastní výzva" (docs/SPEC.md, section 14):
// only the structure and rough summaries, never the values. Column names, a type per column,
// rounded ranges of numbers and dates, and for text only how many different values there are.
// The person sees exactly this in a preview and can leave columns out before sending.

export type ColumnSummary =
  | { name: string; type: "číslo"; empty: number; min: number; max: number }
  | { name: string; type: "datum"; empty: number; from: string; to: string }
  | { name: string; type: "ano/ne"; empty: number }
  | { name: string; type: "text"; empty: number; distinct: number };

export type DataSummary = { fileName: string; rows: number; columns: ColumnSummary[] };

export const limits = { columns: 30, nameLength: 60, rows: 100_000, fileBytes: 10 * 1024 * 1024 };

/** Two significant digits: enough for a believable synthetic range, too rough to leak a value. */
export function roughly(value: number): number {
  if (value === 0 || !Number.isFinite(value)) return 0;
  const magnitude = 10 ** (Math.floor(Math.log10(Math.abs(value))) - 1);
  return Math.round(value / magnitude) * magnitude;
}

const yesNo = new Set(["ano", "ne", "yes", "no", "true", "false", "1", "0", "a", "n"]);
// Czech and ISO dates: 21. 11. 2026, 21.11.2026, 2026-11-21.
const datePattern = /^(\d{1,2})\.\s?(\d{1,2})\.\s?(\d{4})$|^(\d{4})-(\d{2})-(\d{2})/;

function parseNumber(text: string): number | null {
  const cleaned = text.replace(/\s| /g, "").replace(/(Kč|CZK|EUR|€|\$|%)$/i, "").replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  return Number(cleaned);
}

function parseMonth(text: string): string | null {
  const match = text.trim().match(datePattern);
  if (!match) return null;
  const [year, month] = match[3] ? [match[3], match[2]] : [match[4], match[5]];
  return `${year}-${month.padStart(2, "0")}`;
}

/** Summary of a table given as rows of cells, the first row being the header. */
export function summarizeRows(fileName: string, table: unknown[][]): DataSummary {
  const [header = [], ...body] = table;
  const rows = body.filter((row) => row.some((cell) => String(cell ?? "").trim() !== "")).slice(0, limits.rows);
  const names = header.slice(0, limits.columns).map((cell, index) => String(cell ?? "").trim().slice(0, limits.nameLength) || `Sloupec ${index + 1}`);

  const columns = names.map((name, index): ColumnSummary => {
    const cells = rows.map((row) => String(row[index] ?? "").trim());
    const filled = cells.filter((cell) => cell !== "");
    const empty = cells.length - filled.length;
    const numbers = filled.map(parseNumber);
    if (filled.length > 0 && numbers.every((value) => value !== null)) {
      const values = numbers as number[];
      // reduce, not Math.min(...values): Safari refuses more than about 65 000 arguments.
      const min = values.reduce((low, value) => Math.min(low, value), Infinity);
      const max = values.reduce((high, value) => Math.max(high, value), -Infinity);
      return { name, type: "číslo", empty, min: roughly(min), max: roughly(max) };
    }
    const months = filled.map(parseMonth);
    if (filled.length > 0 && months.every((value) => value !== null)) {
      const sorted = (months as string[]).sort();
      return { name, type: "datum", empty, from: sorted[0], to: sorted[sorted.length - 1] };
    }
    if (filled.length > 0 && filled.every((cell) => yesNo.has(cell.toLowerCase()))) return { name, type: "ano/ne", empty };
    return { name, type: "text", empty, distinct: new Set(filled).size };
  });
  return { fileName, rows: rows.length, columns };
}

function decodeText(bytes: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^\uFEFF/, "");
  } catch {
    return new TextDecoder("windows-1250").decode(bytes);
  }
}

/** Reads a CSV or Excel file in the browser and summarises its first sheet. */
export async function summarizeFile(file: File): Promise<DataSummary> {
  if (file.size > limits.fileBytes) throw new Error("Soubor je větší než 10 MB.");
  // Loaded here, not at the top: the claude.ai pages have no custom task and must not carry the
  // library. The "mini" build reads XLSX, XLS, ODS and CSV at a third of the full size.
  const { read, utils } = await import("xlsx/dist/xlsx.mini.min.js");
  const bytes = await file.arrayBuffer();
  // A CSV is text: decode it ourselves. SheetJS would read the bytes as Latin-1 and break Czech
  // letters. Czech Excel saves CSV in windows-1250, so fall back to it when UTF-8 does not fit.
  const isText = /\.(csv|txt|tsv)$/i.test(file.name);
  const workbook = isText
    ? read(decodeText(bytes), { type: "string", raw: false, dense: true })
    : read(bytes, { type: "array", cellDates: false, raw: false, dense: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error("V souboru není žádná tabulka.");
  const table = utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: "" });
  if (table.length < 2) throw new Error("Tabulka má jen záhlaví nebo je prázdná.");
  return summarizeRows(file.name.slice(0, 120), table);
}

/** Czech plural: 1 řádek, 2 řádky, 5 řádků. */
export function plural(count: number, one: string, few: string, many: string): string {
  const word = count === 1 ? one : count >= 2 && count <= 4 ? few : many;
  return `${count.toLocaleString("cs-CZ")} ${word}`;
}

const number = (value: number) => value.toLocaleString("cs-CZ");

/** The exact text that will be sent, shown to the person before sending. */
export function describeSummary(summary: DataSummary, leftOut: Set<string>): string {
  const lines = summary.columns
    .filter((column) => !leftOut.has(column.name))
    .map((column) => {
      const empty = column.empty > 0 ? `, prázdných ${column.empty}` : "";
      if (column.type === "číslo") return `- ${column.name}: číslo, zhruba od ${number(column.min)} do ${number(column.max)}${empty}`;
      if (column.type === "datum") return `- ${column.name}: datum, od ${column.from} do ${column.to}${empty}`;
      if (column.type === "ano/ne") return `- ${column.name}: ano/ne${empty}`;
      return `- ${column.name}: text, ${plural(column.distinct, "hodnota", "různé hodnoty", "různých hodnot")}${empty}`;
    });
  return [`Tabulka „${summary.fileName}“, ${plural(summary.rows, "řádek", "řádky", "řádků")}. Sloupce:`, ...lines].join("\n");
}
