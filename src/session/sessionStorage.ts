import { TaskSession } from "./sessionSchema";

// localStorage can be missing, full, blocked or empty (private window, preview,
// published page with cleared data). Every access is wrapped so the app keeps
// working in memory and never crashes because of storage.

export const sessionKey = (roleId: string) => `role-lab:session:${roleId}`;
const lastRoleKey = "role-lab:last-role";

export function readItem(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeItem(key: string, value: string | null): boolean {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Stored data this version cannot read (written by a newer or older format) would be replaced
 * by a fresh state on the next save, and the person's work would be gone. A copy is kept
 * under a side key first, once, so it can still be recovered by hand.
 */
export function keepUnreadable(key: string, raw: string): void {
  const backupKey = `${key}:neprectene`;
  if (readItem(backupKey) === null) writeItem(backupKey, raw);
}

/** Returns the stored session, or null when there is none or it is unreadable. */
export function loadSession(roleId: string): TaskSession | null {
  const key = sessionKey(roleId);
  const raw = readItem(key);
  if (raw === null) return null;
  try {
    const result = TaskSession.safeParse(JSON.parse(raw));
    if (result.success && result.data.roleId === roleId) return result.data;
  } catch {
    // Not JSON: kept below like any other unreadable record.
  }
  keepUnreadable(key, raw);
  return null;
}

/**
 * True when `stored` is the same attempt as `current` but further on: submitted or evaluated
 * in another tab. Writing `current` over it would silently undo that submission or evaluation.
 */
export function isAheadOf(stored: TaskSession, current: TaskSession): boolean {
  if (stored.startedAt !== current.startedAt) return false;
  return Boolean((stored.submittedAt && !current.submittedAt) || (stored.evaluation && !current.evaluation));
}

/** Returns false when the browser refused to store it. */
export function saveSession(session: TaskSession): boolean {
  return writeItem(sessionKey(session.roleId), JSON.stringify(session));
}

export function deleteSession(roleId: string): void {
  writeItem(sessionKey(roleId), null);
}

export function loadLastRoleId(): string | null {
  return readItem(lastRoleKey);
}

export function saveLastRoleId(roleId: string | null): void {
  writeItem(lastRoleKey, roleId);
}
