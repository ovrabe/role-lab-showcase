import type { GeneratedTask } from "../customTask/generatedTask";
import type { DayMetrics } from "./aggregate";

// The page's side of /api/admin (server/adminHandler.ts). The token lives only in this tab
// (sessionStorage): closing the tab forgets it, and it never goes anywhere but our own server.

const tokenKey = "role-lab:admin-token";

export function loadToken(): string {
  try {
    return window.sessionStorage.getItem(tokenKey) ?? "";
  } catch {
    return "";
  }
}

export function saveToken(token: string | null): void {
  try {
    if (token) window.sessionStorage.setItem(tokenKey, token);
    else window.sessionStorage.removeItem(tokenKey);
  } catch {
    // Without storage the token simply has to be typed again after a reload.
  }
}

export type FeedbackItem =
  | { kind: "note"; message: string; contact?: string; page?: string; at: string }
  | { kind: "evaluation"; rating: string; disagree: string[]; comment?: string; roleId: string; level: number; at: string }
  | { kind: "tester"; answers: { step: string; question: string; answer: string }[]; contact?: string; at: string };

export type AdminOverview = {
  generatedAt: string;
  days: DayMetrics[];
  previousDays: DayMetrics[];
  notifications: { slack: boolean; morning: boolean };
  budget: { perIpUsd: number; totalUsd: number; spentTodayUsd: number };
  limits: { perPerson: Record<string, number>; total: Record<string, number> };
  tasks: { id: string; roleTitle: string; taskTitle: string; difficulty: number }[];
  pendingShares: { id: string; title: string; roleTitle: string; requestedAt: string; brief: { situation: string; task: string }; trap: string; task: GeneratedTask }[];
  generationOff: boolean;
  feedback: FeedbackItem[];
  log: { at: string; action: string; detail?: string }[];
};

export type AdminResult<T> = { ok: true; value: T } | { ok: false; message: string; signOut?: boolean };

const messages: Record<number, string> = {
  401: "Token nesedí.",
  404: "Admin není zapnutý: ve Vercelu chybí ADMIN_TOKEN (aspoň 32 znaků).",
  429: "Dnešní limit je vyčerpaný. Zkus to zítra.",
};

async function post<T>(token: string, body: unknown): Promise<AdminResult<T>> {
  try {
    const response = await fetch("/api/admin", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    if (response.ok) return { ok: true, value: (await response.json()) as T };
    const code = ((await response.json().catch(() => ({}))) as { error?: { code?: string } }).error?.code;
    // A wrong token or a blocked address ends the session; a used-up daily limit does not.
    if (code === "too_many_attempts") return { ok: false, message: "Příliš mnoho chybných pokusů z této adresy. Zkus to zítra.", signOut: true };
    return { ok: false, message: messages[response.status] ?? `Server odpověděl chybou ${response.status}.`, signOut: response.status === 401 };
  } catch {
    return { ok: false, message: "Server neodpovídá. Zkontroluj připojení." };
  }
}

export const fetchOverview = (token: string, days: number) => post<AdminOverview>(token, { action: "overview", days });
export const decideShare = (token: string, id: string, decision: "approved" | "rejected") => post<{ ok: true }>(token, { action: "decide_share", id, decision });
export type AdminSummary = { headline: string; details: string; cached: boolean };
export const fetchSummary = (token: string, days: number, refresh = false) => post<AdminSummary>(token, { action: "summary", days, refresh });
export const askData = (token: string, days: number, question: string) => post<{ answer: string }>(token, { action: "ask", days, question });
export const setGeneration = (token: string, off: boolean) => post<{ ok: true }>(token, { action: "generation", off });
