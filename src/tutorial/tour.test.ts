import { describe, expect, it } from "vitest";
import tourFile from "../../data/tutorial/tour.json";
import categoryManager from "../../data/roles/category-manager.json";
import { parseTour } from "./tour";
import { computeLevel } from "../evaluation/computeLevel";

describe("guided tour", () => {
  it("passes the same checks as a real evaluation, every quote verbatim", () => {
    const result = parseTour(tourFile, categoryManager);
    expect(result.ok ? [] : result.problems).toEqual([]);
  });

  it("numbers turns like a real task, so quoted turns point at the right message", () => {
    const result = parseTour(tourFile, categoryManager);
    if (!result.ok) throw new Error("tour invalid");
    const { transcript } = result.tour.session;
    expect(transcript[0].event).toBe("task_opened");
    expect(transcript.map((item) => item.turn)).toEqual(transcript.map((_, index) => index + 1));
    expect(transcript[1]).toMatchObject({ kind: "user", content: result.tour.steps[0].user });
  });

  it("gets its overall level from the code, like every evaluation", () => {
    const result = parseTour(tourFile, categoryManager);
    if (!result.ok) throw new Error("tour invalid");
    const scores = Object.fromEntries(result.tour.session.evaluation!.output.dimensions.map((dimension) => [dimension.id, dimension.score]));
    expect(computeLevel(result.tour.role, scores as never).level).toBe(3);
  });

  it("rejects a quote that is not in the conversation", () => {
    const broken = structuredClone(tourFile);
    broken.evaluation.dimensions[0].evidence[0].quote = "Tohle nikdo nenapsal.";
    expect(parseTour(broken, categoryManager).ok).toBe(false);
  });

  it("rejects an empty or malformed file", () => {
    expect(parseTour({}, categoryManager).ok).toBe(false);
    expect(parseTour({ ...tourFile, steps: [] }, categoryManager).ok).toBe(false);
    expect(parseTour(tourFile, { id: "x" }).ok).toBe(false);
  });

  it("rejects a tour attached to a different role", () => {
    expect(parseTour({ ...tourFile, roleId: "project-manager" }, categoryManager).ok).toBe(false);
  });
});
