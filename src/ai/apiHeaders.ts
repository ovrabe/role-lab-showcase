import { readItem, writeItem } from "../session/sessionStorage";

/**
 * Headers for every call to the project's server (web version only).
 *
 * x-role-lab-browser is a random number this browser keeps, with no link to the person.
 * The server counts the daily limits per browser, so friends who share one network (an office,
 * a home) do not share one limit. It stores only a keyed hash of it, dropped after two days
 * (server/rateLimit.ts). When storage is blocked, the number lives only while the page is open.
 */
const browserIdKey = "role-lab:browser-id";
let memoryId: string | null = null;

function browserId(): string {
  const stored = readItem(browserIdKey);
  if (stored) return stored;
  const created = memoryId ?? crypto.randomUUID();
  memoryId = created;
  writeItem(browserIdKey, created);
  return created;
}

export function apiHeaders(): Record<string, string> {
  return { "content-type": "application/json", "x-role-lab-browser": browserId() };
}
