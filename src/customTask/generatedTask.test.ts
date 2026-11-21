import { describe, expect, it } from "vitest";
import { checkGeneratedTask, parseSimpleCsv, publicPart } from "./generatedTask";
import { sampleGeneratedTask } from "./sampleGeneratedTask";

const withChange = (change: (task: typeof sampleGeneratedTask) => void) => {
  const copy = structuredClone(sampleGeneratedTask);
  change(copy);
  return copy;
};

describe("checkGeneratedTask", () => {
  it("accepts a task whose trap cell really is in the table", () => {
    expect(checkGeneratedTask(sampleGeneratedTask)).toMatchObject({ ok: true });
  });

  it("rejects a trap pointing at a cell with another value or outside the table", () => {
    expect(checkGeneratedTask(withChange((t) => (t.trap.cell.value = "999")))).toMatchObject({ ok: false, problems: expect.arrayContaining(["trap_cell_value"]) });
    expect(checkGeneratedTask(withChange((t) => (t.trap.cell.row = 40)))).toMatchObject({ ok: false, problems: expect.arrayContaining(["trap_cell_missing"]) });
    expect(checkGeneratedTask(withChange((t) => (t.trap.cell.column = "neni")))).toMatchObject({ ok: false, problems: expect.arrayContaining(["trap_cell_missing"]) });
  });

  it("rejects an explanation that does not name the value", () => {
    expect(checkGeneratedTask(withChange((t) => (t.trap.whatIsWrong = "V listopadu je něco divně.")))).toMatchObject({
      ok: false,
      problems: expect.arrayContaining(["trap_value_not_explained"]),
    });
  });

  it("finds a value written with a space or a decimal comma", () => {
    expect(checkGeneratedTask(withChange((t) => (t.trap.whatIsWrong = "Kapky mají v listopadu 4 100 kusů.")))).toMatchObject({ ok: true });
  });

  it("rejects a table that does not match its columns or is too short", () => {
    expect(checkGeneratedTask(withChange((t) => (t.table.columns[0].name = "polozka")))).toMatchObject({ problems: expect.arrayContaining(["header_mismatch"]) });
    expect(checkGeneratedTask(withChange((t) => (t.table.csv = t.table.csv.split("\n").slice(0, 6).join("\n"))))).toMatchObject({
      problems: expect.arrayContaining(["row_count"]),
    });
    expect(checkGeneratedTask(withChange((t) => (t.table.csv += "\nNavíc,ks,1")))).toMatchObject({ problems: expect.arrayContaining(["ragged_rows"]) });
  });

  it("adds or fixes the length limit instead of rejecting the task", () => {
    const deliverableOf = (text: string) => {
      const result = checkGeneratedTask(withChange((t) => (t.brief.deliverable = text)));
      return result.ok ? result.task.brief.deliverable : null;
    };
    expect(deliverableOf("Krátký e-mail vedoucí.")).toBe("Krátký e-mail vedoucí, nejvýš 800 znaků.");
    expect(deliverableOf("Zpráva pro šéfa. Nejvýš 1 000 znaků.")).toBe("Zpráva pro šéfa. Nejvýš 800 znaků.");
    expect(deliverableOf("Zpráva (maximálně 600 znaků)")).toBe("Zpráva (nejvýš 800 znaků)");
    expect(deliverableOf("E-mail, nejvýš 800 znaků.")).toBe("E-mail, nejvýš 800 znaků.");
  });

  it("rejects an answer of the wrong shape", () => {
    expect(checkGeneratedTask({ title: "Jen název" })).toMatchObject({ ok: false });
    expect(checkGeneratedTask(undefined)).toMatchObject({ ok: false });
  });
});

describe("helpers", () => {
  it("splits the CSV into rows and cells", () => {
    const [header, first] = parseSimpleCsv(sampleGeneratedTask.table.csv);
    expect(header[0]).toBe("lek");
    expect(first).toEqual(["Ibuprofen 400 mg", "ks", "420", "410", "435"]);
  });

  it("keeps the trap and evaluator notes out of what the page sees", () => {
    const visible = JSON.stringify(publicPart(sampleGeneratedTask));
    expect(visible).not.toContain("Jednorázový výkyv");
    expect(visible).not.toContain("judgmentMarkers");
    expect(visible).toContain("Kapky do očí");
  });
});
