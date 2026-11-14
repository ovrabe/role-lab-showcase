import type { TaskSession } from "../session/sessionSchema";
import type { TabId } from "./TabBar";

export type TaskProgress = {
  viewedMaterials: boolean;
  askedAssistant: boolean;
  hasDraft: boolean;
  submitted: boolean;
};

// What the person has done so far, read from the stored session. Drives the step guide in
// the task and the "Rozpracováno / Odevzdáno" label on the home page.
export function taskProgress(session: TaskSession | null): TaskProgress {
  if (!session) return { viewedMaterials: false, askedAssistant: false, hasDraft: false, submitted: false };
  return {
    viewedMaterials: session.transcript.some((item) => item.event === "material_viewed"),
    askedAssistant: session.transcript.some((item) => item.kind === "user"),
    hasDraft: session.submission.trim() !== "",
    submitted: session.submittedAt !== undefined,
  };
}

export type RoleStatus = "new" | "inProgress" | "submitted";

export function roleStatus(progress: TaskProgress): RoleStatus {
  if (progress.submitted) return "submitted";
  return progress.viewedMaterials || progress.askedAssistant || progress.hasDraft ? "inProgress" : "new";
}

export type StepState = "done" | "next" | "todo";

// The four steps of a task in their natural order, each with its state: done, the one to do
// next, or still ahead. Shared by the step overview card and the phone tab bar.
export function stepStates(progress: TaskProgress): Record<TabId, StepState> {
  const done: Record<TabId, boolean> = {
    brief: progress.viewedMaterials || progress.askedAssistant || progress.hasDraft,
    materials: progress.viewedMaterials,
    assistant: progress.askedAssistant,
    submit: progress.submitted,
  };
  const order: TabId[] = ["brief", "materials", "assistant", "submit"];
  const next = order.find((tab) => !done[tab]);
  return Object.fromEntries(order.map((tab) => [tab, done[tab] ? "done" : tab === next ? "next" : "todo"])) as Record<
    TabId,
    StepState
  >;
}
