import { isWebBuild } from "../buildFlags";

/**
 * Vercel BotID in the page (web version only, docs/PRODUCTION.md). BotID loads a small script
 * from our own domain (rewritten to Vercel in vercel.json) and adds a signed header to each
 * protected request; the server asks Vercel about it (server/botCheck.ts).
 *
 * BotID's own fetch wrapper waits for its script before sending. If the script is blocked (an
 * ad blocker, our Content Security Policy) the request would fail or never leave. So the
 * wrapper here sends it without the header after a short wait, and makes sure it is never sent
 * twice: a chat message costs money.
 */

// Every endpoint people call that asks Claude or stores something; admin and cron have secrets.
// Not /api/stats: it sends counts as the tab closes and must not wait, and it costs nothing.
// The server checks the same list (src/ai/botProtection.test.ts compares them).
export const protectedPaths = [
  "/api/chat",
  "/api/evaluate",
  "/api/why",
  "/api/challenge",
  "/api/example",
  "/api/custom-task",
  "/api/custom-task-status",
  "/api/custom-task-share",
  "/api/feedback",
];

// How long a request may wait for BotID's signature before it goes without one.
const signatureWaitMs = 4000;

// BotID copies the request options it gets (with its headers added) before calling the fetch
// beneath it, so this mark travels with them and tells that inner fetch which request it is.
const sendMark = Symbol("bot-protection-send");
type MarkedInit = RequestInit & { [sendMark]?: () => boolean };
type Fetch = typeof fetch;
type InitBotId = (options: { protect: { path: string; method: string }[] }) => void;

function isProtected(input: RequestInfo | URL, init: RequestInit | undefined, origin: string): boolean {
  const url = new URL(input instanceof Request ? input.url : String(input), origin);
  const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
  return url.origin === origin && method === "POST" && protectedPaths.includes(url.pathname);
}

export function installBotProtection(target: { fetch: Fetch }, initBotId: InitBotId, origin: string, waitMs = signatureWaitMs): void {
  const original = target.fetch.bind(target);

  // 1. Beneath BotID: sends a request only if nobody has sent it yet.
  target.fetch = ((input: RequestInfo | URL, init?: MarkedInit) => {
    const claim = init?.[sendMark];
    if (claim && !claim()) return Promise.reject(new DOMException("Already sent without BotID", "AbortError"));
    return original(input, init);
  }) as Fetch;

  initBotId({ protect: protectedPaths.map((path) => ({ path, method: "POST" })) });
  const withBotId = target.fetch;
  // Once BotID has failed, the next requests do not wait for it again until the page reloads.
  let hasFailed = false;

  // 2. Above BotID: what the page calls.
  target.fetch = ((input: RequestInfo | URL, init?: MarkedInit) => {
    // BotID may call fetch again with options it already marked: that is the same request, and
    // it must still ask before sending, even if it was meanwhile sent without BotID.
    if (init?.[sendMark]) return withBotId(input, init);
    if (hasFailed || !isProtected(input, init, origin)) return original(input, init);
    // Already cancelled: fails at once, and says nothing about whether BotID works.
    if (init?.signal?.aborted) return original(input, init);
    return new Promise<Response>((resolve, reject) => {
      // Stops listening for "cancel" once the request has gone one way or the other.
      const done = new AbortController();
      let state: "waiting" | "sent" | "without-botid" = "waiting";
      const sendWithout = (reason: "failed" | "cancelled") => {
        if (state !== "waiting") return;
        state = "without-botid";
        clearTimeout(timer);
        done.abort();
        if (reason === "failed") {
          hasFailed = true;
          console.warn("BotID did not answer, requests go without it until the page reloads.");
        }
        original(input, init).then(resolve, reject);
      };
      const timer = setTimeout(() => sendWithout("failed"), waitMs);
      // A cancelled request (a closed tab, "Stop") should not wait for the timer.
      init?.signal?.addEventListener("abort", () => sendWithout("cancelled"), { once: true, signal: done.signal });
      const claim = () => {
        if (state !== "waiting") return false;
        state = "sent";
        clearTimeout(timer);
        done.abort();
        return true;
      };
      const marked: MarkedInit = { ...init, [sendMark]: claim };
      withBotId(input, marked).then(resolve, (error) => {
        if (state === "sent") reject(error);
        else sendWithout("failed");
      });
    });
  }) as Fetch;
}

export async function startBotProtection(): Promise<void> {
  if (!isWebBuild || !import.meta.env.PROD) return;
  try {
    const { initBotId } = await import("botid/client/core");
    installBotProtection(window, initBotId, window.location.origin);
  } catch {
    // Without BotID the page works as before; the server only logs that the header is missing.
  }
}
