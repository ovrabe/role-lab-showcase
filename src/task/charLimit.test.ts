import { describe, expect, it } from "vitest";
import { loadRoles } from "../roles/loadRoles";
import { charLimitFromDeliverable, submissionCharLimit } from "./SubmissionPanel";

describe("charLimitFromDeliverable", () => {
  it("reads the limit stated in the brief", () => {
    expect(charLimitFromDeliverable("Krátký e-mail pro marketing, nejvýš 800 znaků.")).toBe(800);
    expect(charLimitFromDeliverable("Návrh na jednu stranu, nejvýš 2 500 znaků: objednávka")).toBe(2500);
    expect(charLimitFromDeliverable("Návrh, nejvýš 2 500 znaků.")).toBe(2500);
  });

  it("falls back to the general limit without a stated one", () => {
    expect(charLimitFromDeliverable("Krátký e-mail pro vedoucí.")).toBe(submissionCharLimit);
    expect(charLimitFromDeliverable("")).toBe(submissionCharLimit);
  });

  it("never goes above the general limit", () => {
    expect(charLimitFromDeliverable("Dlouhý text, nejvýš 5 000 znaků.")).toBe(submissionCharLimit);
  });

  // The counter must agree with the brief: every task states its limit in a form this reads.
  const { activeRoles } = loadRoles();
  it.each(activeRoles.map((task) => [task.id, task.brief.deliverable] as const))("%s states a readable limit", (_id, deliverable) => {
    expect(deliverable).toMatch(/nejvýš\s+[\d\s]+\s+znaků/);
    expect([800, 2500]).toContain(charLimitFromDeliverable(deliverable));
  });
});
