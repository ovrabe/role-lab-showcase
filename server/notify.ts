import type { RateLimiter } from "./rateLimit.js";

/**
 * Notifications for the author in Slack (docs/PRODUCTION.md, part 11): short messages to the
 * channel behind SLACK_WEBHOOK_URL (Vercel settings, never in code). Only the kind of event,
 * counts and a link to the admin: nothing a person wrote, no task titles, no contacts. Each kind
 * at most once an hour, so a burst of errors gives one message, not hundreds.
 */

export type NotifyKind = "share" | "budget" | "model_error" | "feedback" | "admin_login" | "page_error";

export type SlackMessage = { text: string; blocks?: unknown[] };
export type Notifier = { post(message: SlackMessage): Promise<void> };

export function slackNotifier(webhookUrl: string): Notifier {
  return {
    async post(message) {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(message),
        signal: AbortSignal.timeout(5_000),
      });
      // Only the status: Slack's answer could echo the webhook details.
      if (!response.ok) throw new Error(`Slack webhook answered ${response.status}`);
    },
  };
}

/** For tests and local development: keeps the messages in memory. */
export function memoryNotifier(): Notifier & { messages: SlackMessage[] } {
  const messages: SlackMessage[] = [];
  return {
    messages,
    async post(message) {
      messages.push(message);
    },
  };
}

// Always the public address: Vercel's cron calls a deployment's own address
// (role-xxxx.vercel.app), which would otherwise end up in the message.
export const adminUrl = "https://role-lab-gamma.vercel.app/?admin";

/**
 * A message with the text and a link to the admin, in Slack's block format. A plain link, not a
 * button: Slack reports a button click to the app and shows a warning when nobody answers, and
 * answering would need another server function just for that.
 */
export function slackMessage(text: string, link: string, linkLabel = "Otevřít admin"): SlackMessage {
  return {
    text,
    blocks: [{ type: "section", text: { type: "mrkdwn", text: `${text}\n\n<${link}|${linkLabel} →>` } }],
  };
}

const pragueHour = (date: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Prague", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" })
    .format(date)
    .replace(", ", "T");

/**
 * Sends one notification of a kind, unless the same kind was already sent this hour.
 * Never fails the request that caused it: a notification is a convenience.
 */
export async function notify(limiter: RateLimiter, kind: NotifyKind, text: string): Promise<void> {
  const notifier = limiter.notifier;
  if (!notifier) return;
  try {
    const now = (limiter.now ?? (() => new Date()))();
    if (limiter.counter.add && (await limiter.counter.add(`notify:${kind}:${pragueHour(now)}`, 1)) > 1) return;
    await notifier.post(slackMessage(text, adminUrl));
  } catch (error) {
    console.error("Slack notification failed:", error instanceof Error ? error.message : error);
  }
}
