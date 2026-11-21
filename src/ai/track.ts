import { isWebBuild } from "../buildFlags";
import { apiHeaders } from "./apiHeaders";

/**
 * Anonymous usage counts for the author (web version only): which task was started,
 * submitted and evaluated, and how many challenges were evaluated. Only the event name and
 * the task id are sent, no text and no identity; the server keeps daily totals
 * (server/statsHandler.ts). Never blocks or breaks the page: failures are ignored.
 */
export type StatsEvent = "task_started" | "task_submitted" | "task_evaluated" | "challenge_evaluated";

export function track(event: StatsEvent, id: string): void {
  // Generated custom tasks are not counted: the server knows only the fixed task ids.
  if (!isWebBuild || id.startsWith("custom-")) return;
  try {
    void fetch("/api/stats", { method: "POST", headers: apiHeaders(), body: JSON.stringify({ event, id }), keepalive: true }).catch(() => {});
  } catch {
    // Counting is a convenience for the author; the person's work never depends on it.
  }
}
