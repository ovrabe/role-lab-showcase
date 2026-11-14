import type { RoleConfig } from "../roles/roleSchema";
import type { StoredEvaluation } from "../evaluation/evaluationSchema";
import type { CalibrationRun } from "./calibrationFixtures";

// One calibration run with its real evaluation, in the shape of a preview sample
// (fixtures/<role>.preview.json), so it can be used for preview and demos as it is.
export function sampleFilename(role: RoleConfig, run: CalibrationRun, round: number): string {
  return `role-lab-ukazka-${role.id}-${run.id}-kolo${round}.json`;
}

export function buildSampleFile(role: RoleConfig, run: CalibrationRun, evaluation: StoredEvaluation): string {
  const { session } = run;
  return JSON.stringify(
    {
      roleId: role.id,
      sampleId: run.id,
      label: run.label,
      _note: `Skutečné hodnocení z kalibrace (${evaluation.evaluatedAt}), běh ${run.label.toLowerCase()}.`,
      startedAt: session.startedAt,
      submittedAt: session.submittedAt,
      transcript: session.transcript,
      submission: session.submission,
      reflection: session.reflection,
      evaluation: evaluation.output,
    },
    null,
    2,
  );
}
