// Approves or rejects sharing of custom tasks (docs/SPEC.md, section 14). Runs only on the
// author's machine: it needs the Upstash URL and token, from the environment or .env.local
// (ignored by git). The token is never printed.
//
//   npm run custom-task                    waiting requests
//   npm run custom-task -- show <id>       the task as people will see it
//   npm run custom-task -- approve <id>    colleagues can open ?vlastni-vyzva=<id>
//   npm run custom-task -- reject <id>     the link stays only for the person who generated it
//   npm run custom-task -- off | on        stops or allows generating new tasks (existing ones keep working)

import { existsSync, readFileSync } from "node:fs";

const pendingKey = "custom-task:pending";
const offKey = "custom-task:off";
const keyOf = (id) => `custom-task:${id}`;

function readEnvFile() {
  if (!existsSync(".env.local")) return {};
  const values = {};
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match) values[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
  return values;
}

const fileEnv = readEnvFile();
const env = (name) => (process.env[name] ?? fileEnv[name])?.trim();
// The Vercel integration for Upstash has used both names over time (server/deps.ts).
const url = env("UPSTASH_REDIS_REST_URL") ?? env("KV_REST_API_URL");
const token = env("UPSTASH_REDIS_REST_TOKEN") ?? env("KV_REST_API_TOKEN");

if (!url || !token) {
  console.error(
    "Chybí přístup k Upstash. Do .env.local doplň UPSTASH_REDIS_REST_URL a UPSTASH_REDIS_REST_TOKEN\n" +
      "(Vercel → projekt → Storage → Upstash → .env.local). Soubor je v .gitignore.",
  );
  process.exit(1);
}

async function redis(...command) {
  const response = await fetch(url.replace(/\/$/, ""), {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(command),
    signal: AbortSignal.timeout(10_000),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.error) throw new Error(`Upstash odpověděl chybou (HTTP ${response.status}).`);
  return body.result;
}

async function load(id) {
  const value = await redis("GET", keyOf(id));
  return typeof value === "string" ? JSON.parse(value) : null;
}

async function list() {
  const ids = (await redis("SMEMBERS", pendingKey)) ?? [];
  let shown = 0;
  for (const id of ids) {
    const record = await load(id);
    // The task expired after 30 days: nothing left to decide.
    if (!record) {
      await redis("SREM", pendingKey, id);
      continue;
    }
    shown++;
    console.log(`${id}  ${record.task.title}\n              ${record.task.roleTitle} · žádost ${record.share?.requestedAt?.slice(0, 10) ?? "?"}`);
  }
  console.log(shown ? `\nČeká ${shown}. Detail: npm run custom-task -- show <id>` : "Žádná žádost o sdílení nečeká.");
  if (await redis("GET", offKey)) console.log("Pozor: generování nových úkolů je vypnuté (npm run custom-task -- on).");
}

function show(record) {
  const { task } = record;
  console.log(`${task.title}\n${task.roleTitle} (${task.roleContext})\n`);
  console.log(`Situace: ${task.brief.situation}\n\nÚkol: ${task.brief.task}\n\nOdevzdává se: ${task.brief.deliverable}\n`);
  console.log(`${task.table.title} (${task.table.period})\n${task.table.csv}\n`);
  console.log(`${task.notes.title}\n${task.notes.markdown}\n`);
  // Everything the evaluator gets too: an instruction could hide in any of it.
  console.log(`Záludnost: ${task.trap.title}\n${task.trap.whatIsWrong}\n`);
  console.log(`Dopad bez kontroly: ${task.trap.naiveEffect}`);
  console.log(`Odhalená, když: ${task.trap.caughtIf}`);
  console.log(`Napůl, když: ${task.trap.partialIf}`);
  console.log(`Přehlédnutá, když: ${task.trap.missedIf}`);
  console.log(`Buňka: řádek ${task.trap.cell.row}, ${task.trap.cell.column} = ${task.trap.cell.value}\n`);
  console.log(`Znaky dobrého úsudku:\n${task.judgmentMarkers.map((marker) => `- ${marker}`).join("\n")}\n`);
  console.log(`Fakta:\n${Object.entries(task.facts).map(([name, value]) => `- ${name}: ${value}`).join("\n")}\n`);
  console.log(`Stav sdílení: ${record.share?.status ?? "nikdo nežádal"}`);
}

async function decide(record, status) {
  const share = { ...(record.share ?? { requestedAt: new Date().toISOString() }), status, decidedAt: new Date().toISOString() };
  // KEEPTTL: the decision does not extend the 30 days. XX: never recreate an expired task.
  const written = await redis("SET", keyOf(record.id), JSON.stringify({ ...record, share }), "KEEPTTL", "XX");
  if (written !== "OK") throw new Error("Úkol mezitím vypršel.");
  await redis("SREM", pendingKey, record.id);
  const ttlDays = Math.floor((await redis("TTL", keyOf(record.id))) / 86_400);
  console.log(
    status === "approved"
      ? `Schváleno. Odkaz pro kolegy: https://role-lab-gamma.vercel.app/?vlastni-vyzva=${record.id}\nÚkol se smaže asi za ${ttlDays} dní.`
      : "Zamítnuto. Úkol zůstává jen tomu, kdo ho vygeneroval.",
  );
}

const [command = "list", id] = process.argv.slice(2);
try {
  if (command === "list") {
    await list();
  } else if (command === "off") {
    await redis("SET", offKey, new Date().toISOString());
    console.log("Generování vypnuto. Rozpracované a sdílené úkoly fungují dál. Zapnutí: npm run custom-task -- on");
  } else if (command === "on") {
    await redis("DEL", offKey);
    console.log("Generování zapnuto.");
  } else if (["show", "approve", "reject"].includes(command)) {
    if (!/^[A-Za-z0-9_-]{12}$/.test(id ?? "")) throw new Error("Chybí id úkolu (12 znaků z odkazu ?vlastni-vyzva=…).");
    const record = await load(id);
    if (!record) throw new Error("Úkol s tímhle id neexistuje nebo už vypršel.");
    if (command === "show") show(record);
    else await decide(record, command === "approve" ? "approved" : "rejected");
  } else {
    throw new Error(`Neznámý příkaz „${command}“. Použij list, show, approve, reject, off nebo on.`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
