import { describe, expect, it } from "vitest";
import { roleStatus, stepStates, taskProgress } from "./taskProgress";
import type { TaskSession, TranscriptItem } from "../session/sessionSchema";

const ts = "2026-11-07T10:00:00.000Z";
const item = (turn: number, fields: Partial<TranscriptItem>): TranscriptItem => ({
  turn,
  kind: "event",
  content: "",
  ts,
  ...fields,
});
const session = (fields: Partial<TaskSession> = {}): TaskSession => ({
  version: 1,
  roleId: "category-manager",
  startedAt: ts,
  transcript: [item(1, { event: "task_opened" })],
  submission: "",
  reflection: "",
  lastSavedSubmission: "",
  ...fields,
});

describe("taskProgress", () => {
  it("treats no stored session as nothing done", () => {
    expect(taskProgress(null)).toEqual({ viewedMaterials: false, askedAssistant: false, hasDraft: false, submitted: false });
    expect(roleStatus(taskProgress(null))).toBe("new");
  });

  it("does not count merely opening the task as progress", () => {
    expect(roleStatus(taskProgress(session()))).toBe("new");
  });

  it("does not count a draft of only spaces and new lines", () => {
    expect(taskProgress(session({ submission: "  \n " })).hasDraft).toBe(false);
  });

  it("notices viewed materials, a question to the assistant and a draft", () => {
    const progress = taskProgress(
      session({
        transcript: [
          item(1, { event: "task_opened" }),
          item(2, { event: "material_viewed", materialId: "sales" }),
          item(3, { kind: "user", content: "Které produkty rostou?" }),
        ],
        submission: "Doporučuji…",
      }),
    );
    expect(progress).toEqual({ viewedMaterials: true, askedAssistant: true, hasDraft: true, submitted: false });
    expect(roleStatus(progress)).toBe("inProgress");
  });

  it("marks a submitted attempt as submitted even with nothing else recorded", () => {
    expect(roleStatus(taskProgress(session({ submittedAt: ts })))).toBe("submitted");
  });
});

describe("stepStates", () => {
  it("points a fresh attempt at reading the brief", () => {
    expect(stepStates(taskProgress(session()))).toEqual({ brief: "next", materials: "todo", assistant: "todo", submit: "todo" });
  });

  it("points at the first step not done, even when a later one is", () => {
    // Asked the assistant without opening the materials: the materials are still next.
    const progress = taskProgress(session({ transcript: [item(1, { kind: "user", content: "Ahoj" })] }));
    expect(stepStates(progress)).toEqual({ brief: "done", materials: "next", assistant: "done", submit: "todo" });
  });

  it("has no next step once everything is done", () => {
    const progress = taskProgress(
      session({
        transcript: [item(1, { event: "material_viewed", materialId: "sales" }), item(2, { kind: "user", content: "Ahoj" })],
        submittedAt: ts,
      }),
    );
    expect(Object.values(stepStates(progress))).toEqual(["done", "done", "done", "done"]);
  });
});
