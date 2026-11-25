import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { guideSteps } from "./homeGuide";

describe("the first-visit guide on the home page", () => {
  it("points only at elements the home page marks, in a short tour", () => {
    const page = readFileSync("src/screens/HomeScreen.tsx", "utf8");
    expect(guideSteps.length).toBeLessThanOrEqual(4);
    for (const step of guideSteps) expect(page).toMatch(new RegExp(`data-guide=(\\{[^}]*)?["']${step.target}["']`));
  });

  it("keeps every bubble short enough to read at a glance", () => {
    for (const step of guideSteps) expect(step.text.length).toBeLessThanOrEqual(180);
  });
});
