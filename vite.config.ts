import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import type { IncomingMessage, ServerResponse } from "node:http";
import { existsSync, readFileSync } from "node:fs";

// The Markdown library uses the replacement character U+FFFD on purpose, but
// the artifact publisher rejects any raw U+FFFD as a sign of a broken file.
// Writing it as the � escape means the same to the browser.
function escapeReplacementCharacter(): Plugin {
  return {
    name: "escape-replacement-character",
    // Runs on the finished bundle: the minifier works after renderChunk and would
    // turn the escape back into the raw character.
    generateBundle(_options, bundle) {
      for (const output of Object.values(bundle)) {
        if (output.type === "chunk") {
          output.code = output.code.replaceAll("�", "\\uFFFD");
        }
      }
    },
  };
}

// The page title also names the artifact in the claude.ai gallery, so the participant
// page gets its own title to tell the two published pages apart.
function participantTitle(): Plugin {
  return {
    name: "participant-title",
    transformIndexHtml: (html) => html.replace("<title>Role Lab</title>", "<title>Role Lab – úkol</title>"),
  };
}

// In `npm run dev:web` the Vite dev server also answers /api/chat and /api/evaluate with
// the same handlers the Vercel functions use (server/handlers.ts), so the web version can
// be tried locally. Without ANTHROPIC_API_KEY in the environment they use the fake Claude.
function localApi(): Plugin {
  return {
    name: "local-api",
    configureServer(server) {
      // The key may sit in .env.local (ignored by git). Vite reads that file only for the page
      // and only VITE_ variables, so it is copied here into this Node process for the handlers.
      // It never reaches the browser: the page is built without it.
      const fileKey = loadEnv("web", process.cwd(), "ANTHROPIC_").ANTHROPIC_API_KEY;
      if (fileKey && !process.env.ANTHROPIC_API_KEY) process.env.ANTHROPIC_API_KEY = fileKey;
      server.config.logger.info(
        process.env.ANTHROPIC_API_KEY?.trim()
          ? "  Role Lab API: skutečný Claude (klíč z prostředí nebo .env.local)"
          : "  Role Lab API: simulace (žádný ANTHROPIC_API_KEY)",
      );
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
        const routes: Record<string, [string, string]> = {
          "/api/chat": ["/server/handlers.ts", "handleChat"],
          "/api/evaluate": ["/server/handlers.ts", "handleEvaluate"],
          "/api/feedback": ["/server/feedback.ts", "handleFeedback"],
          "/api/challenge": ["/server/challengeHandler.ts", "handleChallenge"],
        };
        const route = routes[req.url ?? ""];
        if (!route) return next();
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        const abort = new AbortController();
        res.on("close", () => abort.abort());
        const request = new Request(`http://${req.headers.host ?? "localhost"}${req.url}`, {
          method: req.method,
          headers: req.headers as Record<string, string>,
          body: req.method === "POST" ? Buffer.concat(chunks) : undefined,
          signal: abort.signal,
        });
        const handlers = await server.ssrLoadModule(route[0]);
        const { getServerDeps, misconfiguredResponse } = await server.ssrLoadModule("/server/deps.ts");
        const deps = getServerDeps();
        const response: Response =
          "misconfigured" in deps ? misconfiguredResponse(deps.misconfigured) : await handlers[route[1]](request, deps);
        res.statusCode = response.status;
        response.headers.forEach((value, key) => res.setHeader(key, value));
        if (!response.body) return res.end();
        const reader = response.body.getReader();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
        res.end();
      });
    },
  };
}

// The published artifact must be one self-contained HTML file: all JS, CSS
// and role data get inlined, nothing is fetched at runtime.
// Mode "participant" (npm run build:resitel) builds the page for people taking the task,
// without the author's tools; see src/buildFlags.ts. It goes to its own folder.
// The version shown in the footer comes from package.json, so a release changes it in one place.
const appVersion: string = JSON.parse(readFileSync("package.json", "utf8")).version;

const hasPrivateData = existsSync("evaluator-data") && existsSync("fixtures");

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
    escapeReplacementCharacter(),
    ...(mode === "participant" ? [participantTitle()] : []),
    ...(mode === "web" ? [localApi()] : []),
    viteSingleFile(),
  ],
  // The web build is a participant page too: no calibration, no samples.
  define: {
    __PARTICIPANT_BUILD__: JSON.stringify(mode === "participant" || mode === "web"),
    __WEB_BUILD__: JSON.stringify(mode === "web"),
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  build: { outDir: mode === "participant" ? "dist-resitel" : mode === "web" ? "dist-web" : "dist" },
  // The public copy of the code leaves out the evaluator keys and the sample evaluations,
  // which reveal the data traps (scripts/export-public.sh). Tests that need them run only
  // where they exist, so the public copy still passes its own tests.
  test: {
    exclude: [
      "**/node_modules/**",
      ...(hasPrivateData
        ? []
        : [
            "server/challengeHandler.test.ts",
            "server/content.test.ts",
            "server/handlers.test.ts",
            "server/injection.test.ts",
            "server/rateLimit.test.ts",
            "src/challenges/challengeKeys.test.ts",
            "src/evaluation/validateEvaluation.test.ts",
            "src/progress/progress.test.ts",
            "src/prompts/prompts.test.ts",
            "src/roles/allTasks.test.ts",
            "src/roles/loadRoles.test.ts",
          ]),
    ],
  },
}));
