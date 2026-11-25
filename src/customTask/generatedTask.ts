import { withoutInvisible } from "../text/invisibleCharacters.js";
import { z } from "zod";

// The generator's answer for "Vlastní výzva" (docs/PROMPTS.md, section 6) and the checks code
// runs on it before anyone sees the task. The model invents the data; code makes sure the
// trap it claims is really in the table, so a task never asks people to find something absent.

const text = (max: number) => z.string().trim().min(1).max(max);

export const GeneratedTask = z.object({
  title: text(100),
  roleTitle: text(60),
  roleContext: text(160),
  brief: z.object({ situation: text(700), task: text(600), deliverable: text(250) }),
  table: z.object({
    title: text(100),
    period: text(120),
    columns: z.array(z.object({ name: text(40), meaning: text(200) })).min(3).max(8),
    csv: text(6000),
  }),
  notes: z.object({ title: text(100), markdown: text(1600) }),
  trap: z.object({
    title: text(120),
    whatIsWrong: text(800),
    naiveEffect: text(500),
    caughtIf: text(500),
    partialIf: text(500),
    missedIf: text(400),
    cell: z.object({ row: z.number().int().min(1), column: text(40), value: z.union([z.string(), z.number()]).transform(String) }),
  }),
  judgmentMarkers: z.array(text(400)).min(2).max(5),
  facts: z.record(z.string(), z.union([z.string(), z.number()])),
});
export type GeneratedTask = z.infer<typeof GeneratedTask>;

export const tableLimits = { minRows: 12, maxRows: 30 };

/** Splits the generator's CSV: no quotes or commas inside values are allowed by its instructions. */
export function parseSimpleCsv(csv: string): string[][] {
  return csv
    .trim()
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "")
    .map((line) => line.split(",").map((cell) => cell.trim()));
}

// "1 200,5" and "1200.5" are the same number for the purpose of finding it in a sentence.
const digitsOnly = (value: string) => value.replace(/[\s ]/g, "").replace(",", ".");

export const customCharLimit = 800;

/**
 * The deliverable always states the limit the submission field enforces (charLimitFromDeliverable).
 * The model words it in many ways ("Nejvýš", "maximálně", another number); a whole task is not
 * thrown away for that, the wording is fixed here instead.
 */
export function withCharLimit(deliverable: string): string {
  const limit = `nejvýš ${customCharLimit} znaků`;
  // The number starts with a digit: "\s+[\d\s]+\s+" let a long run of spaces split three ways.
  const stated = /(nejvýš|maximálně|max\.)\s+\d[\d\s\u00a0]*?\s*znaků/i;
  // Keep a capital letter where the limit starts a sentence.
  if (stated.test(deliverable)) return deliverable.replace(stated, (found) => (found[0] === found[0].toUpperCase() ? limit[0].toUpperCase() + limit.slice(1) : limit));
  // Trailing punctuation cut by a loop, not /[.,;:]*$/, which slows down on long runs of dots.
  let text = deliverable.trim();
  while (/[.,;:]$/.test(text)) text = text.slice(0, -1);
  return `${text}, ${limit}.`;
}

export type CheckResult = { ok: true; task: GeneratedTask } | { ok: false; problems: string[] };

/** Parses and checks a generator reply. Problems are short English codes for logs and tests. */
// Every text of a generated task without invisible characters: the author approves what they
// see, and a hidden instruction (tag characters, bidi marks) must not reach other people's
// assistant and evaluator unseen.
function withoutInvisibleDeep(value: unknown): unknown {
  if (typeof value === "string") return withoutInvisible(value);
  if (Array.isArray(value)) return value.map(withoutInvisibleDeep);
  // Key names too: the facts' names go to the evaluator as they are.
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [withoutInvisible(key), withoutInvisibleDeep(item)]));
  return value;
}

export function checkGeneratedTask(raw: unknown): CheckResult {
  const parsed = GeneratedTask.safeParse(withoutInvisibleDeep(raw));
  if (!parsed.success) return { ok: false, problems: parsed.error.issues.slice(0, 5).map((issue) => `schema: ${issue.path.join(".")}`) };
  const task = { ...parsed.data, brief: { ...parsed.data.brief, deliverable: withCharLimit(parsed.data.brief.deliverable) } };
  const problems: string[] = [];

  const [header, ...rows] = parseSimpleCsv(task.table.csv);
  const names = task.table.columns.map((column) => column.name);
  if (header.join(",") !== names.join(",")) problems.push("header_mismatch");
  if (rows.length < tableLimits.minRows || rows.length > tableLimits.maxRows) problems.push("row_count");
  if (rows.some((row) => row.length !== header.length)) problems.push("ragged_rows");

  const { row, column, value } = task.trap.cell;
  const columnIndex = header.indexOf(column);
  const cell = columnIndex >= 0 ? rows[row - 1]?.[columnIndex] : undefined;
  if (cell === undefined) problems.push("trap_cell_missing");
  else if (digitsOnly(cell) !== digitsOnly(value)) problems.push("trap_cell_value");
  if (!digitsOnly(task.trap.whatIsWrong).includes(digitsOnly(value))) problems.push("trap_value_not_explained");

  return problems.length ? { ok: false, problems } : { ok: true, task };
}

/** What the page may see before submission: everything except the trap and the evaluator notes. */
export function publicPart(task: GeneratedTask) {
  const { trap: _trap, judgmentMarkers: _markers, facts: _facts, ...visible } = task;
  return visible;
}
export type PublicGeneratedTask = ReturnType<typeof publicPart>;
