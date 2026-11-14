import { readItem, writeItem } from "../session/sessionStorage";
import { emptyProgress, Progress, withAttempt, type ProgressAttempt } from "./progress";

// Kept apart from the task sessions, so "Začít znovu" clears the task but never the progress.
const progressKey = "role-lab:progress";

export function loadProgress(): Progress {
  const raw = readItem(progressKey);
  if (!raw) return emptyProgress;
  try {
    const parsed = Progress.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : emptyProgress;
  } catch {
    return emptyProgress;
  }
}

/** Saves one finished evaluation. Returns false when the browser does not allow storage. */
export function recordAttempt(attempt: ProgressAttempt): boolean {
  return writeItem(progressKey, JSON.stringify(withAttempt(loadProgress(), attempt)));
}
