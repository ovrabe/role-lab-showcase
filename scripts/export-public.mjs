// Makes the public showcase copy of the project: the code as it is in the last commit,
// without what would spoil the task for people who are going to solve it.
//
//   node scripts/export-public.mjs <empty target folder>
//
// Left out: evaluator-data/ (the evaluator keys with the traps), fixtures/ (sample and
// calibration runs, which discuss the traps) and .claude/ (local tool settings).
// Two sentences in the docs that name the traps are replaced with neutral ones, and the
// README is swapped for the one written for visitors (scripts/public/README.md).
// The patterns below match only the neutral parts of those sentences, so this script
// itself gives nothing away. It stops rather than export anything it could not clean.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync, copyFileSync, statSync } from "node:fs";
import { join } from "node:path";

const target = process.argv[2];
if (!target) throw new Error("Usage: node scripts/export-public.mjs <empty target folder>");
if (existsSync(target) && readdirSync(target).length > 0) throw new Error(`${target} is not empty; refusing to overwrite it`);
mkdirSync(target, { recursive: true });

// Only committed files: nothing local (.env.local, build output) can slip in.
const archive = execFileSync("git", ["archive", "--format=tar", "HEAD"], { maxBuffer: 200_000_000 });
execFileSync("tar", ["-x", "-C", target], { input: archive });
for (const privatePath of ["evaluator-data", "fixtures", ".claude"]) rmSync(join(target, privatePath), { recursive: true, force: true });

function replaceOnce(file, pattern, replacement) {
  const path = join(target, file);
  const text = readFileSync(path, "utf8");
  const matches = text.match(new RegExp(pattern.source, "g")) ?? [];
  if (matches.length !== 1) throw new Error(`${file}: expected the sentence to clean exactly once, found ${matches.length}. Update this script.`);
  writeFileSync(path, text.replace(pattern, replacement));
}

replaceOnce("docs/DEMO.md", /Pak rozbor záludností: [^.]+\./, "Pak rozbor záludností, které byly schované v datech.");
replaceOnce(
  "docs/SPEC.md",
  /slabý \([^)]*\), střední \([^)]*\), silný \([^)]*\)/,
  "slabý, střední a silný (liší se tím, jak systematicky člověk postupuje a kolik záludností zachytí)",
);

copyFileSync("scripts/public/README.md", join(target, "README.md"));
rmSync(join(target, "scripts/public"), { recursive: true, force: true });

// Final check against the real keys: nothing that gives a trap away may appear in the copy.
// Role keys: the trap titles, which name the exact data ("Nulové náklady u …").
// Challenge keys: their titles are short generic phrases that the public rubric uses too
// ("Tvar odpovědi"), so the check looks for the long, specific texts instead: what is
// wrong, when it counts as caught, and the strong answer.
const keyFiles = readdirSync("evaluator-data", { recursive: true }).filter((name) => name.endsWith(".key.json"));
const secrets = keyFiles.flatMap((name) => {
  const key = JSON.parse(readFileSync(join("evaluator-data", name), "utf8"));
  if (!name.startsWith("challenges")) return key.traps.map((trap) => trap.title);
  return [...key.traps.flatMap((trap) => [trap.whatIsWrong, trap.caughtIf]), key.strongAnswer];
});
const trapTitles = secrets.filter((text) => typeof text === "string" && text.trim() !== "").map((text) => text.toLowerCase());
if (trapTitles.length === 0) throw new Error("No key texts found in evaluator-data/; cannot verify the copy");

function filesIn(folder) {
  return readdirSync(folder).flatMap((name) => {
    const path = join(folder, name);
    return statSync(path).isDirectory() ? filesIn(path) : [path];
  });
}
const leaks = filesIn(target).flatMap((path) => {
  const text = readFileSync(path, "utf8").toLowerCase();
  return trapTitles.filter((title) => text.includes(title)).map((title) => `${path}: "${title}"`);
});
if (leaks.length > 0) throw new Error(`Key texts found in the copy:\n${leaks.join("\n")}`);

console.log(`Public copy ready in ${target}: ${filesIn(target).length} files, no evaluator keys, samples or key texts.`);
