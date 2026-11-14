import { z } from "zod";
import { isParticipantBuild } from "../buildFlags";
import type { RoleConfig } from "../roles/roleSchema";
import { TranscriptItem, type TaskSession } from "../session/sessionSchema";
import type { CalibrationRunSpec } from "./calibrationCriteria";

// Synthetic runs for calibrating the evaluator (fixtures/<role>.calibration.json,
// docs/SPEC.md M3.5). If calibration fails, the evaluator prompt changes, not these runs.
// Left out of the participant build: the runs show what a trap is and how it was missed.
const fixtureFiles: Record<string, unknown> = isParticipantBuild
  ? {}
  : import.meta.glob("../../fixtures/*.calibration.json", { eager: true, import: "default" });

const TrapStatus = z.enum(["caught", "partial", "missed"]);

const CalibrationRun = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string(),
  expected: z.object({ rank: z.number().int(), traps: z.record(z.string(), TrapStatus) }),
  startedAt: z.string(),
  submittedAt: z.string(),
  transcript: z.array(TranscriptItem),
  submission: z.string(),
  reflection: z.string(),
});

const CalibrationFile = z.object({ roleId: z.string(), runs: z.array(CalibrationRun).min(1) });

export type CalibrationRun = CalibrationRunSpec & { description: string; session: TaskSession };

export function loadCalibrationRuns(role: RoleConfig): CalibrationRun[] {
  for (const content of Object.values(fixtureFiles)) {
    const parsed = CalibrationFile.safeParse(content);
    if (!parsed.success) {
      console.error("Calibration fixture is invalid:", parsed.error.issues);
      continue;
    }
    if (parsed.data.roleId !== role.id) continue;
    return parsed.data.runs.map((run) => ({
      id: run.id,
      label: run.label,
      description: run.description,
      expected: run.expected,
      session: {
        version: 1,
        roleId: role.id,
        startedAt: run.startedAt,
        submittedAt: run.submittedAt,
        transcript: run.transcript,
        submission: run.submission,
        reflection: run.reflection,
        lastSavedSubmission: run.submission,
      },
    }));
  }
  return [];
}
