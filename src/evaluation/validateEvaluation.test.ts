import { describe, expect, it } from "vitest";
import { validateEvaluation } from "./validateEvaluation";
import { getEvaluatorKey } from "./evaluatorKeys";
import { loadPreviewSamples } from "./previewFixture";
import { loadRoles } from "../roles/loadRoles";
import type { TranscriptItem } from "../session/sessionSchema";

const { activeRoles } = loadRoles();
const role = activeRoles.find((candidate) => candidate.id === "category-manager")!;
const keyTraps = getEvaluatorKey(role.id)!.traps;
// Through the glob, not a static import: the public copy of the code has no fixtures/ and
// skips this file (vite.config.ts), but it must still type-check there.
const fixtureFiles = import.meta.glob("../../fixtures/category-manager.preview-strong.json", { eager: true, import: "default" });
// The tests reshape the raw reply freely (that is the point: broken replies), so its type stays open.
type StrongRun = { transcript: unknown[]; evaluation: any; reflection: string; submission: string };
const strongRun = Object.values(fixtureFiles)[0] as StrongRun;
const transcript = strongRun?.transcript as TranscriptItem[];

// A fresh copy of a real evaluator reply each time: validation sorts and rewrites in place.
type RawReply = typeof strongRun.evaluation;
const realReply = (): RawReply => structuredClone(strongRun.evaluation);
const validate = (raw: unknown, reflection = strongRun.reflection) =>
  validateEvaluation(raw, role, keyTraps, transcript, strongRun.submission, reflection);

describe("validateEvaluation", () => {
  it("accepts a real evaluator reply with every quote verified", () => {
    const result = validate(realReply());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.evaluation.dimensionQuotesVerified.flat().every(Boolean)).toBe(true);
    expect(result.evaluation.trapQuotesVerified.flat().every(Boolean)).toBe(true);
    expect(result.evaluation.codeReviewFlags).toEqual([]);
  });

  it.each([
    ["nothing", null],
    ["a string", "tohle není JSON objekt"],
    ["an empty object", {}],
    ["an array", []],
  ])("rejects %s", (_label, raw) => {
    const result = validate(raw);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems.length).toBeGreaterThan(0);
  });

  it("rejects a score outside 1–4", () => {
    const reply = realReply();
    reply.dimensions[0].score = 7;
    expect(validate(reply).ok).toBe(false);
  });

  it.each([
    ["an empty summary", ""],
    ["a summary of spaces", "   "],
  ])("rejects a reply cut short, with %s", (_label, summary) => {
    const reply = realReply();
    reply.summary = summary;
    reply.strengths = [];
    reply.nextSteps = [];
    const result = validate(reply);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems[0]).toContain("shrnutí");
  });

  it("rejects a reply with a missing dimension", () => {
    const reply = realReply();
    reply.dimensions = reply.dimensions.filter((dimension: { id: string }) => dimension.id !== "judgment");
    const result = validate(reply);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems).toContain("Chybí dimenze judgment.");
  });

  it("rejects a reply with a duplicated dimension", () => {
    const reply = realReply();
    reply.dimensions.push(structuredClone(reply.dimensions[0]));
    expect(validate(reply).ok).toBe(false);
  });

  it("returns the dimensions in rubric order whatever order the model used", () => {
    const reply = realReply();
    reply.dimensions.reverse();
    const result = validate(reply);
    expect(result.ok && result.evaluation.output.dimensions.map((dimension) => dimension.id)).toEqual(
      role.rubric.map((dimension) => dimension.id),
    );
  });

  it("marks a made-up quote as unverified and flags it for review", () => {
    const reply = realReply();
    reply.dimensions[0].evidence[0].quote = "Tuhle větu nikdo nenapsal.";
    const result = validate(reply);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.evaluation.dimensionQuotesVerified[0][0]).toBe(false);
    expect(result.evaluation.codeReviewFlags.some((flag) => flag.includes("citace"))).toBe(true);
  });

  it("marks a quote pointing at a turn that does not exist as unverified", () => {
    const reply = realReply();
    reply.dimensions[0].evidence[0].turn = 999;
    const result = validate(reply);
    expect(result.ok && result.evaluation.dimensionQuotesVerified[0][0]).toBe(false);
  });

  it("moves a quote labelled as submission to the reflection when it comes from there", () => {
    const reply = realReply();
    const reflectionQuote = strongRun.reflection.split(".")[0];
    reply.dimensions[0].evidence = [{ turn: "submission", quote: reflectionQuote }];
    const result = validate(reply);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.evaluation.output.dimensions[0].evidence[0].turn).toBe("reflection");
    expect(result.evaluation.dimensionQuotesVerified[0][0]).toBe(true);
  });

  it("does not verify a reflection quote when the reflection is empty", () => {
    const reply = realReply();
    reply.dimensions[0].evidence = [{ turn: "submission", quote: strongRun.reflection.split(".")[0] }];
    const result = validate(reply, "");
    expect(result.ok && result.evaluation.dimensionQuotesVerified[0][0]).toBe(false);
  });

  it("flags a trap from the key that the evaluator left out, and drops unknown traps", () => {
    const reply = realReply();
    const [, ...otherTraps] = reply.traps;
    reply.traps = [...otherTraps, { ...structuredClone(reply.traps[0]), id: "unknown_trap" }];
    const result = validate(reply);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.evaluation.output.traps.map((trap) => trap.id)).not.toContain("unknown_trap");
    expect(result.evaluation.codeReviewFlags.some((flag) => flag.includes(keyTraps[0].title))).toBe(true);
  });

  it("flags a dimension with no quote and no 'not enough evidence' mark", () => {
    const reply = realReply();
    reply.dimensions[1].evidence = [];
    reply.insufficientEvidence = [];
    const result = validate(reply);
    expect(result.ok && result.evaluation.codeReviewFlags.some((flag) => flag.includes("nemá citaci"))).toBe(true);
  });
});

describe("sample evaluations", () => {
  // Samples come from real evaluations: a new task gets them after its calibration (README,
  // "Jak přidat roli nebo úkol"). Until then this test reminds that they are missing.
  const withSamples = activeRoles.filter((candidate) => loadPreviewSamples(candidate).length > 0);

  it("exist for every task", () => {
    expect(withSamples.map((candidate) => candidate.id)).toEqual(activeRoles.map((candidate) => candidate.id));
  });

  it.each(withSamples.map((candidate) => [candidate.id, candidate] as const))(
    "%s has a weak and a strong sample that pass the same checks as a real evaluation",
    (_id, candidate) => {
      const samples = loadPreviewSamples(candidate);
      expect(samples.map((sample) => sample.id)).toEqual(["weak", "strong"]);
      for (const sample of samples) {
        const evaluation = sample.session.evaluation!;
        expect(evaluation.dimensionQuotesVerified.flat().every(Boolean)).toBe(true);
        expect(evaluation.trapQuotesVerified.flat().every(Boolean)).toBe(true);
      }
    },
  );
});
