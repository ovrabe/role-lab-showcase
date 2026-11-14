import { TaskSession } from "./sessionSchema";

// localStorage can be missing, full, blocked or empty (private window, preview,
// published page with cleared data). Every access is wrapped so the app keeps
// working in memory and never crashes because of storage.

const sessionKey = (roleId: string) => `role-lab:session:${roleId}`;
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

/** Returns the stored session, or null when there is none or it is unreadable. */
export function loadSession(roleId: string): TaskSession | null {
  const raw = readItem(sessionKey(roleId));
  if (raw === null) return null;
  try {
    const result = TaskSession.safeParse(JSON.parse(raw));
    return result.success && result.data.roleId === roleId ? result.data : null;
  } catch {
    return null;
  }
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
