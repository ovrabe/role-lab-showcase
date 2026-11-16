import { describe, expect, it } from "vitest";
import { reportAnswers, scenarioSteps } from "./testerScenario";

describe("tester scenario", () => {
  it("has unique question ids, so drafts and reports never mix answers", () => {
    const ids = scenarioSteps.flatMap((step) => step.questions.map((question) => question.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("stays within what the server accepts: at most 40 questions, short wording", () => {
    const questions = scenarioSteps.flatMap((step) => step.questions);
    expect(questions.length).toBeLessThanOrEqual(40);
    for (const question of questions) expect(question.text.length).toBeLessThanOrEqual(300);
    for (const step of scenarioSteps) expect(step.title.length).toBeLessThanOrEqual(80);
  });

  it("sends only answered questions, trimmed, in scenario order with their wording", () => {
    const report = reportAnswers({ q16: "Možná", q28: " 4 ", q27: "   " });
    expect(report).toEqual([
      { step: "Proč: k čemu Role Lab je", question: "Je jasné, proč aplikace vznikla?", answer: "4" },
      { step: "Co když: co ti to dá", question: "Vrátíš se k Role Labu?", answer: "Možná" },
    ]);
  });

  it("sends nothing for an empty draft", () => {
    expect(reportAnswers({})).toEqual([]);
  });
});
