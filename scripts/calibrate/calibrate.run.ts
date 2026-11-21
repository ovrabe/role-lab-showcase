// Runs one evaluator calibration through the Message Batches API. Start it with
// `npm run calibrate` (scripts/calibrate.mjs passes the options in as environment variables).
// It calls the real Claude and costs money: about 2 $ for one round of every task.
//
// The batch id is saved before waiting, so an interrupted run picks up the same batch on the
// next start instead of paying for a new one. Results reveal the traps: they go to
// calibration-results/, which git ignores and the public copy never contains.

import { it } from "vitest";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { loadServerContent } from "../../server/content";
import { loadCalibrationRuns } from "../../src/calibration/calibrationFixtures";
import { buildBatchRequests, customIdOf, evaluateBatchResult, parseCustomId, verdictsFor, type CalibrationJob, type CellResult } from "./batchCalibration";

const root = process.cwd();
const outputFolder = join(root, "calibration-results");
const pendingFile = join(outputFolder, "pending-batch.json");
const pollSeconds = 60;

// The local key, read without printing it (the same .env.local as `npm run dev:web`).
function readApiKey(): string {
  const env = existsSync(join(root, ".env.local")) ? readFileSync(join(root, ".env.local"), "utf8") : "";
  const key = env.match(/^ANTHROPIC_API_KEY=(.+)$/m)?.[1].trim().replace(/^["']|["']$/g, "");
  if (!key) throw new Error("ANTHROPIC_API_KEY chybí v .env.local.");
  return key;
}

const sleep = (seconds: number) => new Promise((resolve) => setTimeout(resolve, seconds * 1000));
const formatUsd = (value: number) => `${value.toFixed(2).replace(".", ",")} $`;
const mark = (passed: boolean | null) => (passed === null ? "–" : passed ? "ano" : "NE");

it("calibrates the evaluator through the Message Batches API", async () => {
  const taskFilter = process.env.CALIBRATE_TASK?.trim() || null;
  const rounds = Number(process.env.CALIBRATE_ROUNDS ?? "1");
  if (!Number.isInteger(rounds) || rounds < 1 || rounds > 3) throw new Error("Počet kol musí být 1 až 3.");

  const content = loadServerContent(root);
  const tasks = content.roles.activeRoles
    .filter((role) => taskFilter === null || role.id === taskFilter)
    .map((role) => ({ role, runs: loadCalibrationRuns(role), key: content.getEvaluatorKey(role.id) }));
  if (tasks.length === 0) throw new Error(`Úkol „${taskFilter}“ neexistuje.`);
  for (const task of tasks) {
    if (task.runs.length === 0) throw new Error(`Úkol ${task.role.id} nemá kalibrační pokusy ve fixtures/.`);
    if (!task.key) throw new Error(`Úkol ${task.role.id} nemá klíč hodnotitele.`);
  }
  const jobs: CalibrationJob[] = tasks.flatMap(({ role, runs, key }) =>
    runs.flatMap((run) => Array.from({ length: rounds }, (_, index) => ({ role, run, round: index + 1, key: key! }))),
  );
  const jobById = new Map(jobs.map((job) => [customIdOf(job.role.id, job.run.id, job.round), job]));

  const client = new Anthropic({ apiKey: readApiKey(), maxRetries: 2 });
  mkdirSync(outputFolder, { recursive: true });

  // Resume the batch of an interrupted run only when it was for exactly the same requests.
  const signature = [...jobById.keys()].sort().join(",");
  let batchId: string | null = null;
  if (existsSync(pendingFile)) {
    const pending = JSON.parse(readFileSync(pendingFile, "utf8")) as { batchId: string; signature: string };
    if (pending.signature === signature) {
      batchId = pending.batchId;
      console.log(`Navazuji na rozběhnutou dávku ${batchId}.`);
    } else {
      console.log("Uložená dávka byla pro jiné úkoly nebo počet kol, posílám novou.");
    }
  }
  if (!batchId) {
    const batch = await client.messages.batches.create({ requests: buildBatchRequests(jobs) as never });
    batchId = batch.id;
    writeFileSync(pendingFile, JSON.stringify({ batchId, signature, createdAt: new Date().toISOString() }, null, 1));
    console.log(`Odeslána dávka ${batchId}: ${jobs.length} hodnocení (úkoly: ${tasks.length}, kola: ${rounds}).`);
  }

  for (;;) {
    const batch = await client.messages.batches.retrieve(batchId);
    if (batch.processing_status === "ended") break;
    const counts = batch.request_counts;
    console.log(`Čekám na dávku: hotovo ${counts.succeeded + counts.errored + counts.expired + counts.canceled} z ${jobs.length}.`);
    await sleep(pollSeconds);
  }

  const results: CellResult[] = [];
  for await (const entry of await client.messages.batches.results(batchId)) {
    const job = jobById.get(entry.custom_id);
    if (!job || !parseCustomId(entry.custom_id)) continue;
    if (entry.result.type === "succeeded") {
      const message = entry.result.message;
      const text = message.content.map((block) => (block.type === "text" ? block.text : "")).join("");
      results.push(evaluateBatchResult(job, entry.custom_id, { text, usage: message.usage }));
    } else {
      const error = entry.result.type === "errored" ? `chyba API: ${entry.result.error.error.type}` : entry.result.type;
      results.push(evaluateBatchResult(job, entry.custom_id, { error }));
    }
  }

  const verdicts = verdictsFor(tasks, results, rounds);
  const spent = results.reduce((sum, result) => sum + result.costUsd, 0);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const reportFile = join(outputFolder, `calibration-${stamp}.json`);
  writeFileSync(reportFile, JSON.stringify({ batchId, rounds, spentUsd: spent, verdicts, results }, null, 1));
  rmSync(pendingFile, { force: true });

  console.log(`\nKalibrace přes Batch API (kola: ${rounds}), cena ${formatUsd(spent)} (poloviční sazba).`);
  for (const verdict of verdicts) {
    console.log(
      `${verdict.taskId}: pořadí ${mark(verdict.order.passed)}, záludnosti ${mark(verdict.traps.passed)}, stabilita ${mark(verdict.stability.passed)}` +
        (verdict.failed > 0 ? `, neplatných odpovědí ${verdict.failed}` : ""),
    );
    for (const detail of [...verdict.order.details, ...verdict.traps.details, ...verdict.stability.details]) console.log(`  ${detail}`);
  }
  for (const failure of results.filter((result) => !result.ok)) console.log(`  ${failure.customId}: ${"problem" in failure ? failure.problem : ""}`);
  console.log(`\nPodrobnosti: ${reportFile}`);
}, 24 * 60 * 60 * 1000);
