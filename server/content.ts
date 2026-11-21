import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { parseRoles, type LoadedRoles } from "../src/roles/parseRoles.js";
import { findEvaluatorKey, type EvaluatorKey } from "../src/evaluation/evaluatorKeySchema.js";
import { findChallengeKey, parseChallenges, type LoadedChallenges } from "../src/challenges/parseChallenges.js";
import type { ChallengeKey } from "../src/challenges/challengeSchema.js";
import type { RoleDefinition } from "../src/roles/roleSchema.js";
import { parseCustomRole } from "../src/customTask/customTaskRole.js";

/**
 * The web server's view of the role content (docs/SPEC.md, section 13): the same role
 * configs, material files and evaluator keys the page uses, read from disk instead of
 * inlined by Vite, and parsed by the same functions. The evaluator keys live only here
 * in the web build; the page never receives them before submission.
 *
 * Paths are relative to the project root, which is the working directory both in tests
 * and in the deployed function (the files are bundled with it, see vercel.json).
 */
export type ServerContent = {
  roles: LoadedRoles;
  getMaterialText: (file: string) => string | undefined;
  getEvaluatorKey: (roleId: string) => EvaluatorKey | null;
  challenges: LoadedChallenges;
  getChallengeKey: (challengeId: string) => ChallengeKey | null;
  // The generic rubric of generated custom tasks (docs/SPEC.md, section 14).
  customRole: RoleDefinition;
};

function readJsonFiles(directory: string, suffix: string): Record<string, unknown> {
  const files: Record<string, unknown> = {};
  // The public copy of the code has no evaluator keys; the server then answers "missing_key".
  if (!existsSync(directory)) return files;
  for (const name of readdirSync(directory)) {
    if (name.endsWith(suffix)) files[join(directory, name)] = JSON.parse(readFileSync(join(directory, name), "utf8"));
  }
  return files;
}

export function loadServerContent(root: string = process.cwd()): ServerContent {
  const dataDir = join(root, "data");

  // Material files: data/<role>/*.csv|md, keyed like the "file" paths in role configs.
  const materialTexts = new Map<string, string>();
  for (const roleDir of readdirSync(dataDir, { withFileTypes: true })) {
    if (!roleDir.isDirectory() || roleDir.name === "roles") continue;
    for (const name of readdirSync(join(dataDir, roleDir.name))) {
      if (!/\.(csv|md)$/.test(name)) continue;
      const path = join(dataDir, roleDir.name, name);
      materialTexts.set(relative(root, path).split("\\").join("/"), readFileSync(path, "utf8"));
    }
  }
  const getMaterialText = (file: string) => materialTexts.get(file);

  // Role configs are keyed by their path relative to the root, as error messages show it.
  const roleFiles = Object.fromEntries(
    Object.entries(readJsonFiles(join(dataDir, "roles"), ".json")).map(([path, content]) => [
      relative(root, path).split("\\").join("/"),
      content,
    ]),
  );
  const taskFiles = Object.fromEntries(
    Object.entries(readJsonFiles(join(dataDir, "tasks"), ".json")).map(([path, content]) => [
      relative(root, path).split("\\").join("/"),
      content,
    ]),
  );
  const keyFiles = readJsonFiles(join(root, "evaluator-data"), ".key.json");
  const challengeKeyFiles = readJsonFiles(join(root, "evaluator-data", "challenges"), ".key.json");

  return {
    roles: parseRoles(roleFiles, taskFiles, getMaterialText),
    getMaterialText,
    getEvaluatorKey: (roleId) => findEvaluatorKey(keyFiles, roleId),
    challenges: parseChallenges(readJsonFiles(join(dataDir, "challenges"), ".json")),
    getChallengeKey: (challengeId) => findChallengeKey(challengeKeyFiles, challengeId),
    customRole: parseCustomRole(JSON.parse(readFileSync(join(dataDir, "custom-task", "role.json"), "utf8"))),
  };
}
