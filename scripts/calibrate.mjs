// Evaluator calibration through the Message Batches API (half price). Calls the real Claude.
//   npm run calibrate                              one round of every task (about 2 $)
//   npm run calibrate -- --task it-helpdesk-queue  one task (or several, separated by commas)
//   npm run calibrate -- --rounds 3                three rounds (stability check)
// An interrupted run resumes the same batch on the next start with the same options.
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const valueOf = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};

const result = spawnSync("npx", ["vitest", "run", "--config", "scripts/calibrate/vitest.config.ts"], {
  stdio: "inherit",
  env: { ...process.env, CALIBRATE_TASK: valueOf("--task") ?? "", CALIBRATE_ROUNDS: valueOf("--rounds") ?? "1" },
});
process.exit(result.status ?? 1);
