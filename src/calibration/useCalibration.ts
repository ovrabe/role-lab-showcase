import { useEffect, useMemo, useRef, useState } from "react";
import type { DimensionId, RoleConfig } from "../roles/roleSchema";
import type { AiBackend } from "../ai/aiBackend";
import { evaluatorPromptVersion } from "../prompts/evaluator";
import { computeLevel } from "../evaluation/computeLevel";
import { describeEvidencePlace, type StoredEvaluation } from "../evaluation/evaluationSchema";
import { loadCalibrationRuns } from "./calibrationFixtures";
import type { CalibrationCell, TrapStatus } from "./calibrationCriteria";

export const calibrationRounds = 3;

export type CellResult =
  | (CalibrationCell & {
      status: "done";
      scores: Record<string, number>;
      unverifiedQuotes: number;
      // "where: quote" for each quote that was not found, so the author can judge them.
      unverifiedQuoteTexts?: string[];
      // The whole evaluation, so a real run can become a preview or demo sample.
      evaluation?: StoredEvaluation;
    })
  | { status: "failed"; runId: string; round: number; message: string };

// Keyed by prompt version: changing the evaluator instructions starts calibration afresh.
const storageKey = (roleId: string) => `role-lab:calibration:${roleId}:${evaluatorPromptVersion}`;
const cellKey = (runId: string, round: number) => `${runId}#${round}`;

// Results are kept in the browser: nine evaluations cost real usage and must survive a reload.
function loadResults(roleId: string): Record<string, CellResult> {
  try {
    return JSON.parse(window.localStorage.getItem(storageKey(roleId)) ?? "{}");
  } catch {
    return {};
  }
}

function saveResults(roleId: string, results: Record<string, CellResult>) {
  try {
    window.localStorage.setItem(storageKey(roleId), JSON.stringify(results));
  } catch {
    // Storage refused: results stay on screen until the page is closed.
  }
}

export function useCalibration(role: RoleConfig, backend: AiBackend | null) {
  const runs = useMemo(() => loadCalibrationRuns(role), [role]);
  const [results, setResults] = useState<Record<string, CellResult>>(() => loadResults(role.id));
  const [current, setCurrent] = useState<{ runId: string; round: number } | null>(null);
  const [stopMessage, setStopMessage] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const stopRequested = useRef(false);

  useEffect(() => saveResults(role.id, results), [role.id, results]);
  useEffect(() => () => abortRef.current?.abort(), []);

  /** One evaluation. Returns false when the whole calibration should stop. */
  async function evaluateCell(runId: string, round: number): Promise<boolean> {
    const run = runs.find((candidate) => candidate.id === runId);
    if (!backend || !run) return false;
    const controller = new AbortController(); // a new controller for every call
    abortRef.current = controller;
    setCurrent({ runId, round });
    const outcome = await backend.evaluate(role, run.session, controller.signal);
    abortRef.current = null;
    setCurrent(null);

    const store = (result: CellResult) => setResults((previous) => ({ ...previous, [cellKey(runId, round)]: result }));
    if (outcome.kind === "ok") {
      const { output } = outcome.evaluation;
      const scores = Object.fromEntries(output.dimensions.map((dimension) => [dimension.id, dimension.score]));
      const level = computeLevel(role, scores as Record<DimensionId, number>);
      const traps = Object.fromEntries(output.traps.map((trap) => [trap.id, trap.status])) as Record<string, TrapStatus>;
      const allEvidence = [
        ...output.dimensions.flatMap((dimension, index) =>
          dimension.evidence.map((evidence, evidenceIndex) => ({ evidence, ok: outcome.evaluation.dimensionQuotesVerified[index][evidenceIndex], owner: dimension.id })),
        ),
        ...output.traps.flatMap((trap, index) =>
          trap.evidence.map((evidence, evidenceIndex) => ({ evidence, ok: outcome.evaluation.trapQuotesVerified[index][evidenceIndex], owner: trap.id })),
        ),
      ];
      const unverified = allEvidence.filter((item) => !item.ok);
      store({
        status: "done", runId, round, level: level.level, average: level.average, scores, traps,
        unverifiedQuotes: unverified.length,
        unverifiedQuoteTexts: unverified.map(
          ({ evidence, owner }) =>
            `${owner}, ${describeEvidencePlace(evidence.turn)}: ${evidence.quote}`,
        ),
        evaluation: outcome.evaluation,
      });
      return true;
    }
    if (outcome.kind === "invalid") {
      // The technical reason goes into the report, so the author can tell a cut-off reply from a wrong one.
      store({ status: "failed", runId, round, message: `Nepoužitelná odpověď hodnotitele (${outcome.problems.join("; ")})` });
      return true; // one bad reply is a result in itself; the others may still run
    }
    if (outcome.kind === "missing_key") {
      setStopMessage("Pro tuhle roli chybí klíč hodnotitele.");
      return false;
    }
    if (outcome.handling.kind === "silent") return false;
    // Rate limits, consent and similar problems would hit every next call too: stop.
    store({ status: "failed", runId, round, message: outcome.handling.message });
    setStopMessage(outcome.handling.message);
    return false;
  }

  /** Runs the missing cells one after another, round by round, after one click. */
  async function runAll() {
    stopRequested.current = false;
    setStopMessage(null);
    for (let round = 1; round <= calibrationRounds; round++) {
      for (const run of runs) {
        if (stopRequested.current) return;
        if (results[cellKey(run.id, round)]?.status === "done") continue;
        const shouldContinue = await evaluateCell(run.id, round);
        if (!shouldContinue) return;
      }
    }
  }

  const doneCells = Object.values(results).filter(
    (result): result is Extract<CellResult, { status: "done" }> => result.status === "done",
  );

  return {
    runs,
    results,
    doneCells,
    current,
    stopMessage,
    totalCells: runs.length * calibrationRounds,
    resultFor: (runId: string, round: number) => results[cellKey(runId, round)],
    runAll: () => void runAll(),
    retryCell: (runId: string, round: number) => void evaluateCell(runId, round),
    stop: () => {
      stopRequested.current = true;
      abortRef.current?.abort();
    },
    clear: () => setResults({}),
  };
}
