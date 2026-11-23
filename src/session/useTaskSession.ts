import { useCallback, useEffect, useState } from "react";
import type { RoleConfig } from "../roles/roleSchema";
import type { ReviewerReview, TaskSession, TranscriptEvent } from "./sessionSchema";
import { deleteSession, isAheadOf, loadSession, saveSession, sessionKey } from "./sessionStorage";
import type { StoredEvaluation } from "../evaluation/evaluationSchema";
import { track } from "../ai/track";
import type { StoredWhy } from "../evaluation/whyAnswer";

function createSession(roleId: string): TaskSession {
  const now = new Date().toISOString();
  return {
    version: 1,
    roleId,
    startedAt: now,
    transcript: [{ turn: 1, kind: "event", event: "task_opened", content: "Úkol otevřen", ts: now }],
    submission: "",
    reflection: "",
    lastSavedSubmission: "",
  };
}

function withEvent(session: TaskSession, event: TranscriptEvent, content: string, materialId?: string): TaskSession {
  const item = {
    turn: session.transcript.length + 1,
    kind: "event" as const,
    event,
    content,
    ts: new Date().toISOString(),
    ...(materialId ? { materialId } : {}),
  };
  return { ...session, transcript: [...session.transcript, item] };
}

/**
 * The user's message plus one data_attached event per attached material, placed
 * right before it. Pure, so the assistant panel can build the call from the same result.
 */
export function withUserMessage(
  session: TaskSession,
  role: RoleConfig,
  text: string,
  materialIds: string[],
): TaskSession {
  let updated = session;
  for (const materialId of materialIds) {
    const title = role.materials.find((material) => material.id === materialId)?.title ?? materialId;
    updated = withEvent(updated, "data_attached", `Přiložen podklad: ${title}`, materialId);
  }
  const message = { turn: updated.transcript.length + 1, kind: "user" as const, content: text, ts: new Date().toISOString() };
  return { ...updated, transcript: [...updated.transcript, message] };
}

/**
 * Locks the task: records the final text and the submitted event (docs/SPEC.md, section 6).
 * Pure, so the evaluation can start from exactly the state that gets stored.
 */
export function withSubmission(session: TaskSession): TaskSession {
  if (session.submittedAt) return session;
  const submitted = withEvent(session, "submitted", `Odevzdáno (${session.submission.length} znaků)`);
  return { ...submitted, lastSavedSubmission: session.submission, submittedAt: new Date().toISOString() };
}

export function useTaskSession(role: RoleConfig) {
  const [session, setSession] = useState<TaskSession>(() => {
    const stored = loadSession(role.id);
    if (stored) return stored;
    // A new attempt, counted anonymously for the author (web only, src/ai/track.ts).
    track("task_started", role.id);
    return createSession(role.id);
  });
  // False when the browser refuses to store data; the task still works, but a reload would lose it.
  const [isStored, setIsStored] = useState(true);

  // The same task open in two tabs: the tab that was left behind must not write its older
  // state over a submission or evaluation made in the other one. It takes that state instead.
  useEffect(() => {
    const stored = loadSession(role.id);
    if (stored && isAheadOf(stored, session)) {
      setSession(stored);
      return;
    }
    setIsStored(saveSession(session));
  }, [session, role.id]);

  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key !== sessionKey(role.id)) return;
      const stored = loadSession(role.id);
      if (stored) setSession((current) => (isAheadOf(stored, current) ? stored : current));
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [role.id]);

  const materialTitle = (materialId: string) =>
    role.materials.find((material) => material.id === materialId)?.title ?? materialId;

  // Stable identity, because material views use it as an effect dependency.
  const markMaterialViewed = useCallback(
    (materialId: string) => {
      const title = role.materials.find((material) => material.id === materialId)?.title ?? materialId;
      setSession((current) => {
        const alreadyViewed = current.transcript.some(
          (item) => item.event === "material_viewed" && item.materialId === materialId,
        );
        if (alreadyViewed) return current;
        return withEvent(current, "material_viewed", `Podklad zobrazen: ${title}`, materialId);
      });
    },
    [role],
  );

  return {
    session,
    isStored,
    markMaterialViewed,

    markMaterialDownloaded(materialId: string) {
      setSession((current) =>
        withEvent(current, "material_downloaded", `Podklad stažen: ${materialTitle(materialId)}`, materialId),
      );
    },

    addUserMessage(text: string, materialIds: string[]) {
      // How far people get in a task (anonymous counts, src/ai/track.ts).
      if (!session.transcript.some((item) => item.kind === "user")) track("task_step", role.id, { step: "first_message" });
      if (materialIds.length > 0) track("task_step", role.id, { step: "data_attached" });
      setSession((current) => withUserMessage(current, role, text, materialIds));
    },

    addAssistantMessage(content: string) {
      setSession((current) => {
        const item = { turn: current.transcript.length + 1, kind: "assistant" as const, content, ts: new Date().toISOString() };
        return { ...current, transcript: [...current.transcript, item] };
      });
    },

    setSubmission(text: string) {
      setSession((current) => ({ ...current, submission: text }));
    },

    setReflection(text: string) {
      setSession((current) => ({ ...current, reflection: text }));
    },

    // Called when the person leaves the submission field; logs only real changes.
    commitSubmission() {
      setSession((current) => {
        if (current.submission === current.lastSavedSubmission) return current;
        const saved = withEvent(
          current,
          "submission_saved",
          `Odevzdání uloženo (${current.submission.length} znaků)`,
        );
        return { ...saved, lastSavedSubmission: current.submission };
      });
    },

    submit() {
      setSession(withSubmission);
    },

    saveEvaluation(evaluation: StoredEvaluation) {
      setSession((current) => ({ ...current, evaluation }));
    },

    // null removes the review: the AI evaluation applies again as it was.
    saveReview(review: ReviewerReview | null) {
      // A score changed by hand: which area and which way, to see where people disagree with the evaluator.
      const before = session.review?.scores ?? Object.fromEntries((session.evaluation?.output.dimensions ?? []).map((dimension) => [dimension.id, dimension.score]));
      for (const [dimension, score] of Object.entries(review?.scores ?? {})) {
        const previous = before[dimension as keyof typeof before];
        if (previous !== undefined && score !== previous) track("review_change", role.id, { dimension, direction: score > previous ? "up" : "down" });
      }
      setSession((current) => {
        const { review: _previous, ...rest } = current;
        return review ? { ...rest, review } : rest;
      });
    },

    // "Proč tohle skóre?": keeps the answer with the attempt, so it costs nothing a second time.
    saveWhy(dimensionId: string, why: StoredWhy) {
      setSession((current) => ({ ...current, whyAnswers: { ...current.whyAnswers, [dimensionId]: why } }));
    },

    restart() {
      deleteSession(role.id);
      track("task_step", role.id, { step: "restarted" });
      track("task_started", role.id);
      setSession(createSession(role.id));
    },
  };
}

export type TaskSessionControls = ReturnType<typeof useTaskSession>;
