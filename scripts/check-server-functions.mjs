// Runs in `npm run build:web`. Vercel runs api/*.ts as plain Node ES modules: each file
// is compiled to JavaScript on its own, nothing is bundled. Vite and the tests resolve
// imports more leniently, so a missing ".js" in an import works locally and crashes on
// Vercel (that happened once). This compiles the functions the same way, loads them in
// Node and sends each one a request, so the build fails before anything is deployed.
//
// It never calls Claude: the API key is removed from the environment, so the handlers
// use the fake Claude (server/deps.ts).
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const outDir = mkdtempSync(join(tmpdir(), "role-lab-functions-"));
delete process.env.ANTHROPIC_API_KEY;
delete process.env.VERCEL;

const problems = [];
try {
  execFileSync(resolve(root, "node_modules/.bin/tsc"), ["-p", "tsconfig.server.json", "--noEmit", "false", "--outDir", outDir], {
    stdio: "inherit",
  });
  writeFileSync(join(outDir, "package.json"), JSON.stringify({ type: "module" }));
  symlinkSync(resolve(root, "node_modules"), join(outDir, "node_modules"), "dir");

  const chatBody = {
    roleId: "category-manager",
    transcript: [{ turn: 1, kind: "user", content: "Ahoj", ts: "2026-01-01T10:00:00.000Z" }],
  };
  const checks = [
    // A valid chat request streams an answer; a broken evaluate request is refused, not a crash.
    { file: "api/chat.js", body: chatBody, expectedStatus: 200 },
    { file: "api/evaluate.js", body: { nope: true }, expectedStatus: 400 },
    { file: "api/feedback.js", body: { message: "" }, expectedStatus: 400 },
  ];
  for (const { file, body, expectedStatus } of checks) {
    try {
      const module = await import(pathToFileURL(join(outDir, file)).href);
      if (typeof module.POST !== "function") {
        problems.push(`${file}: no POST function exported`);
        continue;
      }
      const response = await module.POST(
        new Request("http://localhost/" + file, { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json", origin: "http://localhost" } }),
      );
      await response.text();
      if (response.status !== expectedStatus) problems.push(`${file}: status ${response.status}, expected ${expectedStatus}`);
    } catch (error) {
      problems.push(`${file}: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`);
    }
  }
} catch (error) {
  problems.push(`Compiling the functions failed: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`);
} finally {
  rmSync(outDir, { recursive: true, force: true });
}

if (problems.length > 0) {
  console.error("Server functions check failed (they would crash on Vercel):\n- " + problems.join("\n- "));
  process.exit(1);
}
console.log("Server functions check passed: all API functions load and answer as plain Node modules.");
