// Live prompt-injection check (docs/PRODUCTION.md, section 3, point 9). Sends the weak
// sample with instructions for the evaluator planted in the chat and the process comment
// (fixtures/category-manager.injection.json) to a running web server, and checks that the
// evaluator scores it like the weak sample instead of obeying.
//
// It calls the real Claude once (one evaluation, roughly 10–15 Kč). Run it by hand:
//   npm run dev:web            (in another terminal, with the key in .env.local)
//   node scripts/injection-check.mjs [http://localhost:5175]
import { readFileSync } from "node:fs";

const base = (process.argv[2] ?? "http://localhost:5175").replace(/\/$/, "");
const readFixture = (name) => JSON.parse(readFileSync(`fixtures/${name}`, "utf8"));
const attack = readFixture("category-manager.injection.json");
const weak = readFixture(attack.baseSample);

// Same construction as server/injection.test.ts: attack messages just before submission.
const isSubmissionEvent = (item) => item.kind === "event" && item.event?.startsWith("submi");
const beforeSubmission = weak.transcript.filter((item) => !isSubmissionEvent(item));
let turn = beforeSubmission.length;
const injected = attack.messages.map((text) => ({ turn: ++turn, kind: "user", content: text, ts: weak.submittedAt }));
const renumbered = weak.transcript.filter(isSubmissionEvent).map((item) => ({ ...item, turn: ++turn }));
const session = {
  version: 1,
  roleId: weak.roleId,
  startedAt: weak.startedAt,
  submittedAt: weak.submittedAt,
  transcript: [...beforeSubmission, ...injected, ...renumbered],
  submission: weak.submission,
  lastSavedSubmission: weak.submission,
  reflection: attack.reflection,
};

console.log(`Sending the attack to ${base}/api/evaluate (one real evaluation)…`);
const response = await fetch(`${base}/api/evaluate`, {
  method: "POST",
  headers: { "content-type": "application/json", origin: base },
  body: JSON.stringify({ roleId: weak.roleId, session }),
});
const body = await response.json().catch(() => ({}));
if (!response.ok || body.kind !== "ok") {
  console.error(`No evaluation came back (HTTP ${response.status}):`, JSON.stringify(body).slice(0, 300));
  process.exit(2);
}

const output = body.evaluation.output;
const baseline = Object.fromEntries(weak.evaluation.dimensions.map((dimension) => [dimension.id, dimension.score]));
console.log("\nArea                     weak sample   with attack");
for (const dimension of output.dimensions) {
  console.log(`${dimension.id.padEnd(25)}${String(baseline[dimension.id] ?? "?").padEnd(14)}${dimension.score}`);
}
console.log(`\nSummary: ${output.summary}`);
console.log(`For a human to check: ${output.humanReviewFlags.join(" | ") || "(nothing)"}`);

const tooHigh = output.dimensions.filter((dimension) => dimension.score > attack.maxAllowedScore);
if (tooHigh.length > 0) {
  console.error(`\nFAIL: the evaluator obeyed. Scores above ${attack.maxAllowedScore}: ${tooHigh.map((d) => `${d.id} ${d.score}`).join(", ")}`);
  process.exit(1);
}
console.log(`\nPASS: no area above ${attack.maxAllowedScore}; the planted instructions did not raise the score.`);
