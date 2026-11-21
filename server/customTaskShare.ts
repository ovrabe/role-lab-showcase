import { z } from "zod";
import { publicPart, type PublicGeneratedTask } from "../src/customTask/generatedTask.js";
import { badRequest, json, limitResponse, readJson } from "./http.js";
import type { CustomTaskDeps } from "./customTaskHandler.js";
import type { StoredCustomTask } from "./customTaskStore.js";
import type { Issue } from "./issues.js";

/**
 * Sharing a custom task (docs/SPEC.md, section 14). The link ?vlastni-vyzva=<id> is both the
 * status page for the person who generated the task and, once the author approves it, the link
 * for colleagues. The server gives the task to another browser only after that approval.
 */

const IdRequest = z.object({ id: z.string().regex(/^[A-Za-z0-9_-]{12}$/) });

export type ShareStatus = "none" | "pending" | "approved" | "rejected";
export type CustomTaskStatusResponse = { kind: "missing" } | { kind: "ok"; status: ShareStatus; task?: PublicGeneratedTask };

const statusOf = (record: StoredCustomTask): ShareStatus => record.share?.status ?? "none";

async function readId(request: Request): Promise<string | Response> {
  const body = await readJson(request, 1_000);
  if (body instanceof Response) return body;
  const parsed = IdRequest.safeParse(body);
  return parsed.success ? parsed.data.id : badRequest("invalid_request", "Invalid task id.");
}

/** POST /api/custom-task-status: the share status, and the task itself once it is approved. */
export async function handleCustomTaskStatus(request: Request, { limiter, customTasks }: CustomTaskDeps): Promise<Response> {
  const id = await readId(request);
  if (id instanceof Response) return id;
  const limited = await limitResponse(limiter, "customTaskStatus", request);
  if (limited) return limited;
  const record = await customTasks.load(id);
  if (!record) return json({ kind: "missing" } satisfies CustomTaskStatusResponse);
  const status = statusOf(record);
  return json({ kind: "ok", status, ...(status === "approved" ? { task: publicPart(record.task) } : {}) } satisfies CustomTaskStatusResponse);
}

/** The author's backlog item: only what the person saw in the task, never the trap or the key. */
export function shareIssue(record: StoredCustomTask): Issue {
  const { task } = record;
  const body = [
    `**Role:** ${task.roleTitle} (${task.roleContext})`,
    "",
    `**Situace:** ${task.brief.situation}`,
    "",
    `**Úkol:** ${task.brief.task}`,
    "",
    `**Odevzdává se:** ${task.brief.deliverable}`,
    "",
    `**Podklady:** ${task.table.title}; ${task.notes.title}`,
    "",
    "Schválit nebo zamítnout u sebe v projektu:",
    "```",
    `npm run custom-task -- approve ${record.id}`,
    `npm run custom-task -- reject ${record.id}`,
    "```",
    "Úkol se smaže 30 dní po vygenerování. Po rozhodnutí issue zavři.",
  ].join("\n");
  return { title: `Vlastní výzva ke schválení: ${task.title}`, body, labels: ["vlastní výzva"] };
}

/** POST /api/custom-task-share: asks the author to approve sharing. Asking twice changes nothing. */
export async function handleCustomTaskShare(request: Request, { limiter, customTasks, issues = null }: CustomTaskDeps): Promise<Response> {
  const id = await readId(request);
  if (id instanceof Response) return id;
  const record = await customTasks.load(id);
  if (!record) return json({ kind: "missing" } satisfies CustomTaskStatusResponse);
  // Already asked or decided: no new issue, no use of the limit.
  if (record.share) return json({ kind: "ok", status: statusOf(record) } satisfies CustomTaskStatusResponse);

  const limited = await limitResponse(limiter, "customTaskShare", request);
  if (limited) return limited;
  const updated = await customTasks.requestShare(id, new Date().toISOString());
  if (!updated) return json({ kind: "missing" } satisfies CustomTaskStatusResponse);
  // The request is already on the author's list (scripts/custom-task.mjs); the issue is a notice.
  if (issues) {
    try {
      await issues.create(shareIssue(updated));
    } catch (error) {
      console.error("Creating the share issue failed:", error);
    }
  }
  return json({ kind: "ok", status: "pending" } satisfies CustomTaskStatusResponse);
}
