export type CsvTable = { header: string[]; rows: string[][] };

/**
 * Minimal CSV reader for our own material files (RFC 4180 style):
 * comma separator, fields may be wrapped in double quotes, a quote inside
 * a quoted field is written as two quotes, line breaks are \n or \r\n.
 * Blank lines are skipped. Rows shorter than the header are padded so the
 * table never shifts columns.
 */
export function parseCsv(text: string): CsvTable {
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let insideQuotes = false;

  for (let index = 0; index < text.length; index++) {
    const char = text[index];

    if (insideQuotes) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"';
        index++;
      } else if (char === '"') {
        insideQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      insideQuotes = true;
    } else if (char === ",") {
      record.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      // \r\n counts as one line break.
      if (char === "\r" && text[index + 1] === "\n") index++;
      record.push(field);
      records.push(record);
      record = [];
      field = "";
    } else {
      field += char;
    }
  }

  // The last line may not end with a line break.
  if (field !== "" || record.length > 0) {
    record.push(field);
    records.push(record);
  }

  const nonBlank = records.filter((row) => !(row.length === 1 && row[0].trim() === ""));
  if (nonBlank.length === 0) return { header: [], rows: [] };

  const [header, ...rows] = nonBlank;
  const paddedRows = rows.map((row) =>
    row.length < header.length ? [...row, ...Array(header.length - row.length).fill("")] : row,
  );
  return { header, rows: paddedRows };
}
