import { apiHeaders } from "../ai/apiHeaders";
import { handleSampleError } from "../assistant/sampleErrors";
import type { PublicGeneratedTask } from "./generatedTask";

// The page's side of POST /api/custom-task (server/customTaskHandler.ts).

export type CustomTaskInput = { role: string; situation: string; deliverable: string; data: string | null };
export type CustomTaskOutcome = { kind: "ok"; id: string; task: PublicGeneratedTask } | { kind: "error"; message: string };

// Messages for the codes that are specific to generating; the rest uses the shared wording.
const messages: Record<string, string> = {
  limit_person: "Dnešní vlastní výzva už je vygenerovaná. Další půjde zítra.",
  limit_daily: "Dnešní kapacita pro vlastní výzvy je vyčerpaná. Zkus to prosím zítra.",
  invalid: "Úkol se nepodařilo vygenerovat tak, aby dával smysl. Pokus se nepočítá, zkus popis upřesnit a vygenerovat znovu.",
  invalid_request: "Popis je moc krátký nebo moc dlouhý. Situaci napiš aspoň ve dvou větách.",
  custom_tasks_off: "Generování vlastních výzev je teď vypnuté. Už vygenerované úkoly fungují dál.",
  sensitive_data: "V popisu je e-mail, rodné číslo nebo číslo účtu. Odstraň je a zkus to znovu.",
};

export async function requestCustomTask(input: CustomTaskInput, signal?: AbortSignal): Promise<CustomTaskOutcome> {
  try {
    const response = await fetch("/api/custom-task", { method: "POST", headers: apiHeaders(), body: JSON.stringify(input), signal });
    const body = (await response.json().catch(() => ({}))) as
      | { kind: "ok"; id: string; task: PublicGeneratedTask }
      | { kind: "invalid"; problems: string[] }
      | { kind: "error"; code: string; message: string }
      | { error?: { code?: string } };
    if ("kind" in body && body.kind === "ok") return body;
    const code = "kind" in body ? (body.kind === "invalid" ? "invalid" : body.code) : (body.error?.code ?? "upstream_error");
    return { kind: "error", message: messages[code] ?? handleSampleError({ code }).message ?? "Něco se pokazilo. Zkus to prosím znovu." };
  } catch {
    return { kind: "error", message: handleSampleError({ code: "upstream_error" }).message };
  }
}

// Sharing (server/customTaskShare.ts). "missing": the task expired or the link is wrong.
export type ShareStatus = "none" | "pending" | "approved" | "rejected";
export type StatusOutcome =
  | { kind: "ok"; status: ShareStatus; task?: PublicGeneratedTask }
  | { kind: "missing" }
  | { kind: "error"; message: string };

async function postId(path: string, id: string): Promise<StatusOutcome> {
  try {
    const response = await fetch(path, { method: "POST", headers: apiHeaders(), body: JSON.stringify({ id }) });
    const body = (await response.json().catch(() => ({}))) as StatusOutcome | { error?: { code?: string } };
    if ("kind" in body && (body.kind === "ok" || body.kind === "missing")) return body;
    const code = ("error" in body && body.error?.code) || "upstream_error";
    return { kind: "error", message: handleSampleError({ code }).message || "Něco se pokazilo. Zkus to prosím znovu." };
  } catch {
    return { kind: "error", message: handleSampleError({ code: "upstream_error" }).message };
  }
}

export const fetchCustomTaskStatus = (id: string) => postId("/api/custom-task-status", id);
export const requestCustomTaskShare = (id: string) => postId("/api/custom-task-share", id);

/** The one link for both: the status for whoever generated the task, the task for colleagues once approved. */
export const customTaskLink = (id: string) => `${window.location.origin}/?vlastni-vyzva=${id}`;
