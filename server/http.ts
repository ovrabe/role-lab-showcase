import { takeFromLimit, type LimitedAction, type RateLimiter } from "./rateLimit.js";

/**
 * Request checks shared by every endpoint, so each one gets the same protection:
 * POST only, only from our own page, a size cap, valid JSON and the daily limits.
 */

export const json = (body: unknown, status = 200) =>
  // no-store: answers and evaluations are personal; no browser or proxy should keep a copy.
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

export const badRequest = (code: string, message: string, status = 400) => json({ error: { code, message } }, status);

// Browsers always send Origin with a POST. Accepting only our own page stops other websites
// from making their visitors' browsers call the endpoints (each visitor has a fresh limit).
// It does not stop a script that fakes the header: the daily limits are the real protection.
function isOwnPage(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

/** The parsed JSON body, or the error response to send instead. */
export async function readJson(request: Request, maxBodyBytes = 1_000_000): Promise<unknown | Response> {
  if (request.method !== "POST") return badRequest("method_not_allowed", "Use POST.", 405);
  if (!isOwnPage(request)) return badRequest("forbidden_origin", "Requests are accepted only from the Role Lab page.", 403);
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > maxBodyBytes) return badRequest("too_large", "Request body too large.", 413);
  const text = await request.text();
  if (text.length > maxBodyBytes) return badRequest("too_large", "Request body too large.", 413);
  try {
    return JSON.parse(text);
  } catch {
    return badRequest("invalid_json", "Body is not JSON.");
  }
}

// Counted only for requests that passed every check. A counter that cannot be reached
// blocks the request: no limits means no protection against spending or spam.
export async function limitResponse(limiter: RateLimiter, action: LimitedAction, request: Request): Promise<Response | null> {
  let code;
  try {
    code = await takeFromLimit(limiter, action, request);
  } catch (error) {
    console.error("Rate limit counter failed:", error);
    return badRequest("service_unavailable", "Limit counter unavailable.", 503);
  }
  return code ? badRequest(code, "Daily limit reached.", 429) : null;
}
