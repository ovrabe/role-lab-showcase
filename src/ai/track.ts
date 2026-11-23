import { isWebBuild } from "../buildFlags";
import { apiHeaders } from "./apiHeaders";

/**
 * Anonymous usage counts for the author (web version only): which screens are opened, how
 * tasks go (started, first message, submitted, evaluated), which attempt it was, scores changed
 * by hand and errors on the page. Only fixed event names, ids from the app and small numbers
 * are sent, never text and no identity; the server keeps daily totals (server/statsHandler.ts,
 * server/pageEvents.ts). Never blocks or breaks the page: failures are ignored.
 */
export type StatsEvent =
  | "task_started"
  | "task_submitted"
  | "task_evaluated"
  | "challenge_evaluated"
  | "screen_view"
  | "task_step"
  | "client_error"
  | "attempt"
  | "review_change"
  | "tour_completed";

type Extra = Record<string, string | number>;

export function track(event: StatsEvent, id: string, extra: Extra = {}): void {
  if (!isWebBuild) return;
  // Generated custom tasks have random ids; they are counted together.
  const reportedId = id.startsWith("custom-") ? "custom" : id;
  try {
    void fetch("/api/stats", {
      method: "POST",
      headers: apiHeaders(),
      body: JSON.stringify({ event, id: reportedId, ...extra }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Counting is a convenience for the author; the person's work never depends on it.
  }
}

// A broken script can throw in a loop; one report per page load is enough to see it.
let scriptErrorReported = false;

/** Counts errors outside React's rendering (event handlers, promises). Called once at start. */
export function trackScriptErrors(): void {
  if (!isWebBuild) return;
  const report = () => {
    if (scriptErrorReported) return;
    scriptErrorReported = true;
    track("client_error", "script");
  };
  window.addEventListener("error", report);
  window.addEventListener("unhandledrejection", report);
}
