import { clientAddress } from "./rateLimit.js";
import { createHmac } from "node:crypto";
import { z } from "zod";
import { dimensionIds } from "../src/roles/roleSchema.js";
import type { MetricEntries } from "./metrics.js";

/**
 * What the page may report for the admin page's metrics (src/ai/track.ts), besides the task
 * events in statsHandler.ts. Every value is from a fixed list or a small number, so nothing a
 * person wrote can get in and nobody can fill the store with made-up names.
 */

// The screens of src/AppScreens.tsx; ids of tasks and challenges are never sent here.
export const screenNames = [
  "home", "methodology", "about", "makingOf", "customTask", "profile", "releaseNotes",
  "challenge", "challengeMap", "calibration", "samples", "tour", "testing", "role", "task",
] as const;
export const taskSteps = ["first_message", "data_attached", "restarted"] as const;

const TaskId = z.string().max(80);

export const PageEvent = z.discriminatedUnion("event", [
  z.object({ event: z.literal("screen_view"), id: z.enum(screenNames) }),
  z.object({ event: z.literal("task_step"), id: TaskId, step: z.enum(taskSteps) }),
  z.object({ event: z.literal("client_error"), id: z.enum(["render", "script"]) }),
  // A finished evaluation seen from the person's browser: which attempt at the task it was and
  // how the overall level moved against the previous one (0 for the first attempt).
  z.object({ event: z.literal("attempt"), id: TaskId, attempt: z.number().int().min(1).max(100), levelChange: z.number().int().min(-3).max(3) }),
  // A score changed by hand on the result screen (docs/SPEC.md, section 4.5).
  z.object({ event: z.literal("review_change"), id: TaskId, dimension: z.enum(dimensionIds), direction: z.enum(["up", "down"]) }),
  z.object({ event: z.literal("tour_completed"), id: z.literal("tour") }),
]);
export type PageEvent = z.infer<typeof PageEvent>;

// First, second, third attempt, then everything later together.
const attemptBucket = (attempt: number) => (attempt >= 4 ? "4plus" : String(attempt));

/** The metric names one event adds to (server/metrics.ts). taskKey is a real task id or "custom". */
export function pageEventMetrics(event: PageEvent, taskKey: string): MetricEntries {
  switch (event.event) {
    case "screen_view":
      return { [`screen.${event.id}`]: 1 };
    case "task_step":
      return { [`funnel.${taskKey}.${event.step}`]: 1 };
    case "client_error":
      return { [`client_error.${event.id}`]: 1 };
    case "attempt":
      return {
        [`progress.${taskKey}.attempt.${attemptBucket(event.attempt)}`]: 1,
        ...(event.attempt > 1 ? { [`progress.${taskKey}.level_change.${event.levelChange}`]: 1 } : {}),
      };
    case "review_change":
      return { [`review.${taskKey}.${event.dimension}.${event.direction}`]: 1 };
    case "tour_completed":
      return { "tour.completed": 1 };
  }
}

/**
 * The visitor's mark for counting unique visitors of one day: a keyed hash of the address and
 * the browser name with a key that changes every day. Nothing is stored in the browser, the
 * mark cannot be turned back into an address and the same person gets another mark tomorrow,
 * so visits cannot be linked across days. Only a HyperLogLog estimate keeps it (metrics.ts).
 */
export function dailyVisitorMark(request: Request, secret: string, day: string): string {
  const ip = clientAddress(request);
  const agent = request.headers.get("user-agent") ?? "";
  const dailyKey = createHmac("sha256", secret).update(`visitors:${day}`).digest();
  return createHmac("sha256", dailyKey).update(`${ip}|${agent}`).digest("hex").slice(0, 16);
}
