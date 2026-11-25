// Runs after `vite build --mode web` (npm run build:web). The web page must not contain
// anything the server keeps secret (docs/PRODUCTION.md, section 3): the evaluator keys,
// the evaluator's instructions, or an API key. Fails the build if it finds any of them.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const page = readFileSync("dist-web/index.html", "utf8");
const problems = [];

// Every trap explanation from every evaluator key.
// The public copy of the code has no evaluator keys, so there is nothing of them to leak.
// Role keys sit in evaluator-data/, challenge keys in evaluator-data/challenges/.
const keyFiles = existsSync("evaluator-data") ? readdirSync("evaluator-data", { recursive: true }) : [];
// Every string in a key that is a sentence, not a value: short ones (product names, numbers)
// also appear in the visible materials, so only text of 40+ characters is checked. That covers
// trap explanations and conditions, judgment markers, acceptable answers and fact notes.
function sentencesIn(value, found = []) {
  if (typeof value === "string" && value.trim().length >= 40) found.push(value.trim());
  else if (Array.isArray(value)) value.forEach((item) => sentencesIn(item, found));
  else if (value && typeof value === "object") Object.values(value).forEach((item) => sentencesIn(item, found));
  return found;
}

for (const name of keyFiles.filter((file) => file.endsWith(".key.json"))) {
  const { _warning, ...key } = JSON.parse(readFileSync(join("evaluator-data", name), "utf8"));
  for (const trap of key.traps ?? []) {
    for (const text of [trap.title, trap.whatIsWrong]) {
      if (typeof text === "string" && page.includes(text)) problems.push(`${name}: trap ${trap.id} found in the page`);
    }
  }
  for (const sentence of sentencesIn(key)) {
    if (page.includes(sentence)) problems.push(`${name}: key text found in the page: "${sentence.slice(0, 60)}…"`);
  }
}

// The evaluator's instructions: the first line of the block after "## 2. Hodnotitel" in docs/PROMPTS.md.
const promptsDoc = readFileSync("docs/PROMPTS.md", "utf8").replace(/\r\n/g, "\n");
const evaluatorBlock = promptsDoc.slice(promptsDoc.indexOf("## 2. Hodnotitel")).match(/```[a-z]*\n([\s\S]*?)\n```/)?.[1] ?? "";
const firstLine = evaluatorBlock.split("\n").find((line) => line.trim().length > 30)?.trim();
if (!firstLine) problems.push("Could not read the evaluator instructions from docs/PROMPTS.md");
else if (page.includes(firstLine)) problems.push("Evaluator instructions found in the page");

// The challenge evaluator's instructions (docs/PROMPTS.md, section 4), built only on the server.
const challengeBlock = promptsDoc.slice(promptsDoc.indexOf("### Pokyny hodnotitele výzev")).match(/```[a-z]*\n([\s\S]*?)\n```/)?.[1] ?? "";
const challengeLine = challengeBlock.split("\n").find((line) => line.trim().length > 30)?.trim();
if (!challengeLine) problems.push("Could not read the challenge evaluator instructions from docs/PROMPTS.md");
else if (page.includes(challengeLine)) problems.push("Challenge evaluator instructions found in the page");

// Anything that looks like an Anthropic API key.
if (/sk-ant-[A-Za-z0-9_-]{10,}/.test(page)) problems.push("Something like an Anthropic API key found in the page");

// Anything that looks like a GitHub token (the issues token is server-only, like the API key).
if (/(github_pat_|ghp_|gho_|ghs_)[A-Za-z0-9_]{20,}/.test(page)) problems.push("Something like a GitHub token found in the page");

// The other server-only settings: the Slack webhook, the Upstash database, private keys.
if (/hooks\.slack\.com\/services\/[A-Za-z0-9/]+/.test(page)) problems.push("Something like a Slack webhook found in the page");
if (/https:\/\/[a-z0-9-]+\.upstash\.io/.test(page)) problems.push("An Upstash database address found in the page");
if (/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(page)) problems.push("A private key found in the page");

if (problems.length > 0) {
  console.error("Web bundle check failed:\n- " + problems.join("\n- "));
  process.exit(1);
}
console.log("Web bundle check passed: no evaluator keys, evaluator instructions, API keys, tokens, webhooks or database addresses in dist-web/index.html.");
