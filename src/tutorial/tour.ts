import { z } from "zod";
import { RoleDefinition, type RoleConfig } from "../roles/roleSchema.js";
import type { TaskSession, TranscriptItem } from "../session/sessionSchema.js";
import { validateEvaluation } from "../evaluation/validateEvaluation.js";

// The guided tour (data/tutorial/tour.json): a made-up mini task with a scripted conversation
// and a sample evaluation. Nothing in it comes from a real task or an evaluator key, so it can
// ship in every build and in the public copy. It never calls AI.

const nonEmpty = z.string().trim().min(1);

const TourFile = z.object({
  roleId: nonEmpty,
  title: nonEmpty,
  // Who the scripted assistant works for; shown nowhere yet, kept for the role config.
  assistantContext: nonEmpty,
  // Hints for the screens around the conversation; the conversation has its own per message.
  coach: z.object({ brief: nonEmpty, submission: nonEmpty, result: nonEmpty }),
  brief: z.object({ situation: nonEmpty, task: nonEmpty, deliverable: nonEmpty }),
  material: z.object({
    title: nonEmpty,
    note: nonEmpty,
    columns: z.array(nonEmpty).min(1),
    rows: z.array(z.array(z.string())).min(1),
  }),
  // Each step: a hint for the person, the prepared message they send, the scripted reply.
  steps: z.array(z.object({ coach: nonEmpty, user: nonEmpty, assistant: nonEmpty })).min(1),
  submission: nonEmpty,
  keyTraps: z.array(z.object({ id: nonEmpty, title: nonEmpty, whatIsWrong: nonEmpty, naiveEffect: z.string().optional() })),
  evaluation: z.unknown(),
});
export type TourFile = z.infer<typeof TourFile>;

export type Tour = TourFile & { role: RoleConfig; session: TaskSession };

const fixedTime = "2026-11-15T10:00:00.000Z";

// Turn numbers as the real task numbers them: 1 is opening the task, then message after message.
// The sample evaluation quotes these numbers, so they must stay predictable.
export function tourTranscript(steps: TourFile["steps"]): TranscriptItem[] {
  const items: TranscriptItem[] = [{ turn: 1, kind: "event", event: "task_opened", content: "Úkol otevřen", ts: fixedTime }];
  for (const step of steps) {
    items.push({ turn: items.length + 1, kind: "user", content: step.user, ts: fixedTime });
    items.push({ turn: items.length + 1, kind: "assistant", content: step.assistant, ts: fixedTime });
  }
  return items;
}

/** Checks the tour file and builds what the result screen needs; problems are listed, not thrown. */
export function parseTour(rawTour: unknown, rawRole: unknown): { ok: true; tour: Tour } | { ok: false; problems: string[] } {
  const tourResult = TourFile.safeParse(rawTour);
  if (!tourResult.success) return { ok: false, problems: tourResult.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`) };
  const roleResult = RoleDefinition.safeParse(rawRole);
  if (!roleResult.success) return { ok: false, problems: ["Role prohlídky není platná."] };
  const file = tourResult.data;
  const { id: roleId, ...shared } = roleResult.data;
  if (roleId !== file.roleId) return { ok: false, problems: [`Prohlídka patří roli ${file.roleId}, ne ${roleId}.`] };

  const role: RoleConfig = {
    ...shared,
    id: "tour",
    roleId,
    taskTitle: file.title,
    difficulty: 1,
    assistantContext: file.assistantContext,
    timeLimitMinutes: 2,
    brief: { ...file.brief, howToWork: "V prohlídce nic nepíšeš: posíláš připravené zprávy a sleduješ, co se děje.", dataNote: file.material.note },
    materials: [],
  };
  const transcript = tourTranscript(file.steps);
  // The same check as a real evaluation, quote by quote: the tour must show only what the app really does.
  const result = validateEvaluation(file.evaluation, role, file.keyTraps, transcript, file.submission, "");
  if (!result.ok) return { ok: false, problems: result.problems };
  const unverified = [...result.evaluation.dimensionQuotesVerified, ...result.evaluation.trapQuotesVerified].flat().filter((verified) => !verified);
  if (unverified.length > 0 || result.evaluation.codeReviewFlags.length > 0) {
    return { ok: false, problems: ["Některá citace v ukázkovém hodnocení není doslova v rozhovoru nebo v odevzdání.", ...result.evaluation.codeReviewFlags] };
  }

  const session: TaskSession = {
    version: 1,
    roleId: role.id,
    startedAt: fixedTime,
    submittedAt: fixedTime,
    transcript,
    submission: file.submission,
    reflection: "",
    lastSavedSubmission: file.submission,
    // keyTraps travel with the evaluation, as in the web build: the result screen explains the
    // trap from them and never looks for a real evaluator key.
    evaluation: { ...result.evaluation, keyTraps: file.keyTraps },
  };
  return { ok: true, tour: { ...file, role, session } };
}
