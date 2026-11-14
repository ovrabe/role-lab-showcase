import { useEffect, useState } from "react";
import type { AiBackend } from "../ai/aiBackend";
import { webBackend } from "../ai/webBackend";
import { isWebBuild } from "../buildFlags";

export type AiAvailability = "checking" | "available" | "preview";

export type SampleFunction = typeof Claude.sample;

// The runtime typings declare window.claude as always present, but outside
// claude.ai (npm run dev, a file opened by double-click) it does not exist.
function getClaude(): Claude | undefined {
  return (window as { claude?: Claude }).claude;
}

// Only in `npm run dev`: ?simulace in the address swaps in a fake Claude for testing.
// In the build import.meta.env.DEV is false, so this whole branch and the mock are dropped.
export const isSimulation = import.meta.env.DEV && new URLSearchParams(window.location.search).has("simulace");

/**
 * Tells the app whether it can call Claude.
 * - No window.claude at all: preview mode immediately, no waiting.
 * - Inside claude.ai: use("sample") resolves later; null means no AI, so preview.
 * Calling use() asks the viewer nothing and costs nothing; consent comes on the first real call.
 */
export function useAiAvailability(): {
  status: AiAvailability;
  backend: AiBackend | null;
  isSimulation: boolean;
} {
  const claude = getClaude();
  // The web build always has its server; whether the server works shows on the first call.
  const [status, setStatus] = useState<AiAvailability>(isWebBuild ? "available" : claude || isSimulation ? "checking" : "preview");
  const [backend, setBackend] = useState<AiBackend | null>(isWebBuild ? webBackend : null);

  useEffect(() => {
    if (isWebBuild) return;
    let cancelled = false;

    if (import.meta.env.DEV && isSimulation) {
      Promise.all([import("./devMockSample"), import("../ai/aiBackend")]).then(([{ devMockSample }, { claudeAiBackend }]) => {
        if (cancelled) return;
        setBackend(claudeAiBackend(devMockSample));
        setStatus("available");
      });
      return () => {
        cancelled = true;
      };
    }

    if (!claude) return;
    // Loaded here, not at the top: the claude.ai backend builds the evaluator's instructions
    // in the page, and the web build must not contain them (scripts/check-web-bundle.mjs).
    // Behind the isWebBuild return above, this import is dropped from the web build.
    Promise.all([claude.use("sample"), import("../ai/aiBackend")])
      .then(([sampleFn, { claudeAiBackend }]) => {
        if (cancelled) return;
        if (sampleFn) {
          setBackend(claudeAiBackend(sampleFn));
          setStatus("available");
        } else {
          setStatus("preview");
        }
      })
      .catch(() => {
        if (!cancelled) setStatus("preview");
      });
    return () => {
      cancelled = true;
    };
  }, [claude]);

  return { status, backend, isSimulation };
}
