import { timingSafeEqual, createHash } from "node:crypto";
import { json, badRequest } from "./http.js";
import { adminUrl, slackMessage } from "./notify.js";
import { memoryAdminLog, overview, readDays, writeSummary, type AdminDeps } from "./adminHandler.js";
import { digest } from "../src/admin/digest.js";
import { pragueDay } from "./metrics.js";
import { attentionItems } from "../src/admin/attention.js";
import type { AdminOverview as PageOverview } from "../src/admin/adminApi.js";

/**
 * GET /api/cron-morning (docs/PRODUCTION.md, part 11): every morning Vercel calls it (vercel.json,
 * "crons") and it posts to Slack the AI summary of the last 7 days, yesterday's numbers and how
 * many things need attention. Only Vercel may call it: it sends CRON_SECRET from the project
 * settings as a Bearer token, compared in constant time. Without Slack it does nothing.
 */

const same = (given: string, expected: string) => {
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(given), digest(expected));
};

const maxMorningMessagesPerDay = 5;

const usd = (value: number) => `${value.toFixed(2).replace(".", ",")} $`;

export async function handleMorning(request: Request, deps: AdminDeps & { cronSecret: string | undefined }): Promise<Response> {
  const secret = deps.cronSecret;
  const given = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || secret.length < 16 || !same(given, secret)) return badRequest("unauthorized", "Not allowed.", 401);
  // The daily cleanup, with or without Slack: notes older than 90 days go even on days with no
  // new note (they used to wait for the next one, so up to 180 days).
  try {
    await deps.feedback.prune();
  } catch (error) {
    console.error("Pruning old feedback failed:", error);
  }
  const notifier = deps.limiter.notifier;
  if (!notifier) return json({ skipped: "no Slack webhook" });

  const now = (deps.limiter.now ?? (() => new Date()))();
  // Vercel calls once a day; a few more are the author's "Run" in the Vercel settings (to show
  // it to someone). More would mean a leaked secret: no message flood in Slack then.
  const today = (await deps.limiter.counter.add?.(`morning:${pragueDay(now)}`, 1)) ?? 1;
  if (today > maxMorningMessagesPerDay) return json({ skipped: "enough messages today" });
  const [yesterday] = await readDays(deps.limiter, 1, 1, now);
  const numbers = digest([yesterday]);
  const data = await overview(deps, deps.adminLog ?? memoryAdminLog(), 7, now);
  const titleOf = (id: string) => (id === "custom" ? "Vlastní výzvy" : (data.tasks.find((task) => task.id === id)?.taskTitle ?? id));
  const attention = attentionItems(data as unknown as PageOverview, titleOf, now);
  const summary = await writeSummary(deps, 7, false, now, request.signal);

  const lines = [
    "*Role Lab · ranní přehled*",
    summary.ok ? `*${summary.summary.headline}*\n${summary.summary.details}` : "_Shrnutí se dnes nepodařilo napsat._",
    `Včera: ${numbers.visitors} návštěvníků · ${numbers.funnel.started} začatých úkolů · ${numbers.funnel.evaluated} ohodnocených · útrata ${usd(numbers.spendUsd)}`,
    attention.length > 0 ? `Co řešit: ${attention.length} (${attention.filter((item) => item.level === "warning").length} upozornění)` : "Co řešit: nic",
  ];
  await notifier.post(slackMessage(lines.join("\n\n"), adminUrl, "Otevřít admin"));
  return json({ posted: true });
}
