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

export const adminUrl = (request?: Request) => `${request ? new URL(request.url).origin : "https://role-lab-gamma.vercel.app"}/?admin`;

/** A message with a line of text and a button to the admin, in Slack's block format. */
export function slackMessage(text: string, link: string, buttonLabel = "Otevřít admin"): SlackMessage {
  return {
    text,
    blocks: [
      { type: "section", text: { type: "mrkdwn", text } },
      { type: "actions", elements: [{ type: "button", text: { type: "plain_text", text: buttonLabel }, url: link }] },
    ],
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
export async function notify(limiter: RateLimiter, kind: NotifyKind, text: string, request?: Request): Promise<void> {
  const notifier = limiter.notifier;
  if (!notifier) return;
  try {
    const now = (limiter.now ?? (() => new Date()))();
    if (limiter.counter.add && (await limiter.counter.add(`notify:${kind}:${pragueHour(now)}`, 1)) > 1) return;
    await notifier.post(slackMessage(text, adminUrl(request)));
  } catch (error) {
    console.error("Slack notification failed:", error instanceof Error ? error.message : error);
  }
}
