import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadServerContent } from "./content";
import { loadRoles } from "../src/roles/loadRoles";
import { getMaterialText } from "../src/materials/materialFiles";
import { getEvaluatorKey } from "../src/evaluation/evaluatorKeys";
import { loadPreviewSamples } from "../src/evaluation/previewFixture";
import { loadCalibrationRuns } from "../src/calibration/calibrationFixtures";
// A session to build prompts from: a sample evaluation if the task has one, otherwise its
// first calibration run (new tasks get samples only after they are calibrated).
const sessionFor = (task: Parameters<typeof loadPreviewSamples>[0]) =>
  loadPreviewSamples(task)[0]?.session ?? loadCalibrationRuns(task)[0].session;

import { buildAssistantTurns } from "../src/prompts/assistant";
import { buildEvaluatorPrompt } from "../src/prompts/evaluator";
import type { TranscriptItem } from "../src/session/sessionSchema";

// The web server must send Claude exactly what the claude.ai page sends (docs/SPEC.md,
// section 13). Here the page's content (inlined by Vite) is compared with the server's
// (read from disk), and the prompts built from both must be identical.
const server = loadServerContent();
const page = loadRoles();

describe("server content matches the page", () => {
  it("loads the same active roles without errors", () => {
    expect(server.roles.errors).toEqual([]);
    expect(server.roles.activeRoles).toEqual(page.activeRoles);
    expect(server.roles.upcomingRoleTitles).toEqual(page.upcomingRoleTitles);
  });

  describe.each(page.activeRoles.map((role) => [role.id, role] as const))("%s", (_id, role) => {
    it("reads every material file with the same text", () => {
      for (const material of role.materials) {
        expect(server.getMaterialText(material.file)).toBe(getMaterialText(material.file));
      }
    });

    it("has the same evaluator key", () => {
      expect(server.getEvaluatorKey(role.id)).toEqual(getEvaluatorKey(role.id));
    });

    it("builds the same assistant turns, attachments included", () => {
      // Every material attached to the first message, then an answer and a follow-up.
      const transcript: TranscriptItem[] = [
        ...role.materials.map((material, index) => ({
          turn: index + 1,
          kind: "event" as const,
          event: "data_attached" as const,
          materialId: material.id,
          content: `Přiložen podklad: ${material.title}`,
          ts: "2026-11-08T10:00:00.000Z",
        })),
        { turn: 90, kind: "user", content: "Projdi podklady.", ts: "2026-11-08T10:01:00.000Z" },
        { turn: 91, kind: "assistant", content: "Hotovo.", ts: "2026-11-08T10:02:00.000Z" },
        { turn: 92, kind: "user", content: "Co dál?", ts: "2026-11-08T10:03:00.000Z" },
      ];
      expect(buildAssistantTurns(role, transcript, server.getMaterialText)).toEqual(
        buildAssistantTurns(role, transcript, getMaterialText),
      );
    });

    it("builds the same evaluator prompt", () => {
      const session = sessionFor(role);
      expect(buildEvaluatorPrompt(role, server.getEvaluatorKey(role.id)!, session)).toBe(
        buildEvaluatorPrompt(role, getEvaluatorKey(role.id)!, session),
      );
    });
  });
});

// A server function cannot run code that only Vite understands. Everything the server
// imports from src/ must therefore be free of import.meta (glob, env).
describe("server imports no Vite-only code", () => {
  it.each([
    "src/roles/parseRoles.ts",
    "src/roles/roleSchema.ts",
    "src/session/sessionSchema.ts",
    "src/evaluation/evaluatorKeySchema.ts",
    "src/evaluation/evaluationSchema.ts",
    "src/evaluation/validateEvaluation.ts",
    "src/evaluation/verifyQuote.ts",
    "src/prompts/assistant.ts",
    "src/prompts/evaluator.ts",
    "src/assistant/promptBudget.ts",
  ])(
    "%s",
    (file) => {
      expect(readFileSync(file, "utf8")).not.toContain("import.meta");
    },
  );
});
