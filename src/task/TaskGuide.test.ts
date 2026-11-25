import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { taskGuideSteps } from "./TaskGuide";

describe("the first-visit guide on a task", () => {
  it("points at elements both task layouts mark", () => {
    const wide = readFileSync("src/task/TaskLayouts.tsx", "utf8") + readFileSync("src/task/TabBar.tsx", "utf8");
    for (const step of taskGuideSteps) {
      // The tabs come from the tab bar; the assistant and submit steps from the wide layout's
      // panels or, on a phone, from the tab bar's buttons (data-guide={`task-${tab}`}).
      const tabButton = /^task-(brief|materials|assistant|submit)$/.test(step.target) && wide.includes("data-guide={`task-${tab}`}");
      expect(tabButton || wide.includes(`data-guide="${step.target}"`)).toBe(true);
    }
    expect(taskGuideSteps.map((step) => step.target)).toEqual(["task-brief", "task-assistant", "task-submit"]);
  });

  it("does not tell people that the data hide traps", () => {
    for (const step of taskGuideSteps) expect(step.text).not.toMatch(/záludn|chyb[ay] v datech|past/i);
  });
});
