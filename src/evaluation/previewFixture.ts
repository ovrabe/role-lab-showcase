import { z } from "zod";
import type { RoleConfig } from "../roles/roleSchema";
import { TranscriptItem, type TaskSession } from "../session/sessionSchema";
import { getEvaluatorKey } from "./evaluatorKeys";
import { validateEvaluation } from "./validateEvaluation";
import { isParticipantBuild } from "../buildFlags";

// Sample runs per role (fixtures/<role>.preview*.json) shown in preview mode, where no
// evaluator can run (docs/SPEC.md, section 8), and for demos (docs/DEMO.md: weak and strong).
// They are made-up people's work, always labelled as samples, never mixed with the viewer's own.
// Left out of the participant build: the samples reveal the data traps.
const fixtureFiles: Record<string, unknown> = isParticipantBuild
  ? {}
  : import.meta.glob("../../fixtures/*.preview*.json", { eager: true, import: "default" });

const PreviewFixture = z.object({
  roleId: z.string(),
  sampleId: z.string().optional(),
  label: z.string().optional(),
  startedAt: z.string(),
  submittedAt: z.string(),
  transcript: z.array(TranscriptItem),
  submission: z.string(),
  reflection: z.string(),
  evaluation: z.unknown(),
});

export type PreviewSample = { id: string; label: string; session: TaskSession };

// Weak before strong reads naturally in a demo; anything else keeps file order.
const sampleOrder = ["weak", "medium", "strong"];

/**
 * All valid samples of a role. Each goes through the same validation as a real
 * evaluation, quote check included; a broken one is left out and reported in the console.
 */
export function loadPreviewSamples(role: RoleConfig): PreviewSample[] {
  const samples: PreviewSample[] = [];
  for (const [path, content] of Object.entries(fixtureFiles)) {
    const parsed = PreviewFixture.safeParse(content);
    if (!parsed.success || parsed.data.roleId !== role.id) continue;
    const fixture = parsed.data;
    const key = getEvaluatorKey(role.id);
    const result = validateEvaluation(
      fixture.evaluation,
      role,
      key?.traps ?? [],
      fixture.transcript,
      fixture.submission,
      fixture.reflection,
    );
    if (!result.ok) {
      console.error(`Sample ${path} is invalid:`, result.problems);
      continue;
    }
    samples.push({
      id: fixture.sampleId ?? path,
      label: fixture.label ?? "Ukázka",
      session: {
        version: 1,
        roleId: role.id,
        startedAt: fixture.startedAt,
        submittedAt: fixture.submittedAt,
        transcript: fixture.transcript,
        submission: fixture.submission,
        reflection: fixture.reflection,
        lastSavedSubmission: fixture.submission,
        evaluation: result.evaluation,
      },
    });
  }
  const rank = (sample: PreviewSample) => {
    const index = sampleOrder.indexOf(sample.id);
    return index < 0 ? sampleOrder.length : index;
  };
  return samples.sort((a, b) => rank(a) - rank(b));
}
