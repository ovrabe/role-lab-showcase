import { useState } from "react";
import type { RoleConfig } from "../roles/roleSchema";
import type { AiAvailability } from "../runtime/useAiAvailability";
import type { AiBackend } from "../ai/aiBackend";
import { calibrationRounds, useCalibration } from "./useCalibration";
import { checkOrder, checkStability, checkTraps, type CriterionVerdict } from "./calibrationCriteria";
import { CalibrationTable } from "./CalibrationTable";
import { evaluatorPromptVersion } from "../prompts/evaluator";

type CalibrationPanelProps = { role: RoleConfig; aiStatus: AiAvailability; backend: AiBackend | null };

const verdictLabel = (verdict: CriterionVerdict) =>
  verdict.passed === true ? "Splněno" : verdict.passed === false ? "Nesplněno" : "Zatím nelze posoudit";

// For the author only (docs/SPEC.md, M3.5): evaluates each calibration run three times and
// checks order, trap statuses and stability. Spends the author's own usage.
export function CalibrationPanel({ role, aiStatus, backend }: CalibrationPanelProps) {
  const calibration = useCalibration(role, backend);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);
  const { runs, doneCells, current } = calibration;
  const missing = calibration.totalCells - doneCells.length;

  if (runs.length === 0) {
    return <p className="text-ink-muted">Pro roli {role.title} zatím nejsou kalibrační běhy.</p>;
  }

  // Built from this role's runs: the project manager has no medium run, for example.
  const orderLabel = [...runs]
    .sort((a, b) => a.expected.rank - b.expected.rank)
    .map((run) => run.label.toLowerCase())
    .join(" < ");
  const verdicts = [
    { name: `Pořadí ${orderLabel} ve všech kolech`, verdict: checkOrder(runs, doneCells, calibrationRounds) },
    { name: "Stav záludností odpovídá záměru", verdict: checkTraps(runs, doneCells) },
    { name: "Úroveň stejného běhu kolísá nejvýš o jednu", verdict: checkStability(runs, doneCells) },
  ];
  // Full evaluations stay out of the text report; they are downloaded per row as samples.
  const resultsForReport = Object.fromEntries(
    Object.entries(calibration.results).map(([key, result]) => {
      if (result.status !== "done") return [key, result];
      const { evaluation: _evaluation, ...summary } = result;
      return [key, summary];
    }),
  );
  const report = JSON.stringify(
    { role: role.id, promptVersion: evaluatorPromptVersion, verdicts: verdicts.map(({ name, verdict }) => ({ name, result: verdictLabel(verdict), ...verdict })), results: resultsForReport },
    null,
    2,
  );

  return (
    <section className="space-y-6">
      <div className="card max-w-2xl space-y-2">
        <p>
          Každý ze tří vymyšlených běhů ({runs.map((run) => run.label.toLowerCase()).join(", ")}) se ohodnotí{" "}
          {calibrationRounds}× stejným hodnotitelem jako v aplikaci. Hodnocení běží postupně, ne naráz.
        </p>
        <p className="text-ink-muted">
          Verze pokynů hodnotitele: {evaluatorPromptVersion}. Po změně pokynů začíná kalibrace načisto.
        </p>
        <ul className="space-y-1.5 pt-1">
          {runs.map((run) => (
            <li key={run.id} className="rounded-control bg-paper px-4 py-2.5 text-sm">
              <strong>{run.label}:</strong> <span className="text-ink-muted">{run.description}</span>
            </li>
          ))}
        </ul>
      </div>

      {aiStatus !== "available" ? (
        <p className="bg-notice text-notice-ink rounded-control p-3 max-w-2xl">Kalibrace běží jen v publikované stránce v claude.ai.</p>
      ) : current ? (
        <div role="status" className="flex flex-wrap items-center gap-3">
          <span>
            Hodnotím: {runs.find((run) => run.id === current.runId)?.label}, kolo {current.round} ({doneCells.length + 1} z{" "}
            {calibration.totalCells}). Jedno hodnocení obvykle trvá 1–2 minuty.
          </span>
          <button type="button" onClick={calibration.stop} className="rounded-full border border-line px-3 py-1.5">
            Zastavit
          </button>
        </div>
      ) : isConfirming ? (
        <div role="alertdialog" aria-label="Spustit kalibraci" className="space-y-3 max-w-2xl">
          <p>
            Spustí se {missing} hodnocení nejsilnějším modelem. Potrvá to asi {Math.ceil(missing * 1.5)} minut a spotřebuje
            to citelnou část tvého limitu. Stránku nech po tu dobu otevřenou.
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={() => { setIsConfirming(false); calibration.runAll(); }} className="rounded-full bg-action text-action-contrast px-4 py-2 font-medium">
              Spustit
            </button>
            <button type="button" autoFocus onClick={() => setIsConfirming(false)} className="rounded-full border border-line px-4 py-2">
              Zrušit
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={missing === 0} onClick={() => setIsConfirming(true)} className="rounded-full bg-action text-action-contrast px-4 py-2 font-medium disabled:opacity-50">
            {doneCells.length === 0 ? "Spustit kalibraci" : `Dokončit kalibraci (zbývá ${missing})`}
          </button>
          {Object.keys(calibration.results).length > 0 &&
            (isConfirmingClear ? (
              <>
                <button type="button" onClick={() => { setIsConfirmingClear(false); calibration.clear(); }} className="rounded-full bg-action text-action-contrast px-4 py-2 font-medium">
                  Opravdu smazat
                </button>
                <button type="button" autoFocus onClick={() => setIsConfirmingClear(false)} className="rounded-full border border-line px-4 py-2">
                  Ponechat
                </button>
              </>
            ) : (
              // Results cost real usage, so clearing them needs a second click.
              <button type="button" onClick={() => setIsConfirmingClear(true)} className="rounded-full border border-line px-4 py-2">
                Smazat výsledky
              </button>
            ))}
        </div>
      )}
      {calibration.stopMessage && <p role="alert" className="bg-notice text-notice-ink rounded-control p-3 max-w-2xl">Kalibrace se zastavila: {calibration.stopMessage}</p>}

      <ul className="card space-y-2 max-w-2xl">
        {verdicts.map(({ name, verdict }) => (
          <li key={name}>
            <span className="font-semibold">{verdictLabel(verdict)}</span> · {name}
            {verdict.details.length > 0 && <span className="block text-sm text-ink-muted">{verdict.details.join(". ")}</span>}
          </li>
        ))}
      </ul>

      <CalibrationTable role={role} calibration={calibration} canRetry={aiStatus === "available" && !current} />

      <details className="max-w-2xl">
        <summary className="cursor-pointer text-accent">Výsledky jako text pro autora</summary>
        <p className="text-ink-muted mt-2">Označ text, zkopíruj ho a pošli do Claude Code.</p>
        <textarea readOnly value={report} rows={10} className="w-full mt-2 font-mono text-xs rounded-control border border-line bg-surface p-2" onFocus={(event) => event.target.select()} />
      </details>
    </section>
  );
}
