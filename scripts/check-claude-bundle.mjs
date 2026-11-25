// Runs after `npm run build` and `npm run build:resitel`. The pages for claude.ai must not
// send anything anywhere (CLAUDE.md: the only way out is claude.use("sample")). Bot protection
// and analytics belong to the web version only; this fails the build if they slipped in.
import { readFileSync } from "node:fs";

const file = process.argv[2];
const page = readFileSync(file, "utf8");
const forbidden = [
  ["BotID", /149e9513-01fa-4fb0-aad4-566afd725d1b|bot-protection|KPSDK/],
  ["Vercel Analytics", /\/_vercel\/(insights|speed-insights)/],
];
const found = forbidden.filter(([, pattern]) => pattern.test(page)).map(([name]) => name);
if (found.length > 0) {
  console.error(`${file}: found ${found.join(", ")}, which belong to the web version only.`);
  process.exit(1);
}
console.log(`${file}: no bot protection or analytics, as it should be for claude.ai.`);
