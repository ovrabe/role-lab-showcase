import type { RoleConfig } from "../roles/roleSchema";
import { calibrationRounds, type useCalibration } from "./useCalibration";
import { SaveFileButton } from "../components/SaveFileButton";
import { buildSampleFile, sampleFilename } from "./sampleFile";

const trapLabels = { caught: "zachyceno", partial: "částečně", missed: "nezachyceno" } as const;

type CalibrationTableProps = {
  role: RoleConfig;
  calibration: ReturnType<typeof useCalibration>;
  canRetry: boolean;
};

export function CalibrationTable({ role, calibration, canRetry }: CalibrationTableProps) {
  const trapIds = [...new Set(calibration.runs.flatMap((run) => Object.keys(run.expected.traps)))];
  return (
    <div className="rl-scroll-box overflow-x-auto border border-line rounded-control bg-surface">
      <table className="text-sm tabular-nums border-separate border-spacing-0">
        <thead>
          <tr>
            {["Běh", "Kolo", "Úroveň", "Průměr", ...role.rubric.map((dimension) => dimension.name), ...trapIds, "Neověřené citace", ""].map((heading) => (
              <th key={heading} scope="col" className="text-left px-3 py-2 border-b border-line font-semibold whitespace-nowrap">
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {calibration.runs.flatMap((run) =>
            Array.from({ length: calibrationRounds }, (_, index) => index + 1).map((round) => {
              const result = calibration.resultFor(run.id, round);
              const isRunning = calibration.current?.runId === run.id && calibration.current.round === round;
              return (
                <tr key={`${run.id}-${round}`}>
                  <td className="px-3 py-1.5 border-b border-line whitespace-nowrap">{run.label}</td>
                  <td className="px-3 py-1.5 border-b border-line">{round}</td>
                  {result?.status === "done" ? (
                    <>
                      <td className="px-3 py-1.5 border-b border-line">{result.level}</td>
                      <td className="px-3 py-1.5 border-b border-line">{result.average.toFixed(1).replace(".", ",")}</td>
                      {role.rubric.map((dimension) => (
                        <td key={dimension.id} className="px-3 py-1.5 border-b border-line">{result.scores[dimension.id]}</td>
                      ))}
                      {trapIds.map((trapId) => {
                        const actual = result.traps[trapId];
                        const matches = actual === run.expected.traps[trapId];
                        return (
                          <td key={trapId} className={`px-3 py-1.5 border-b border-line whitespace-nowrap ${matches ?"" : "font-semibold underline decoration-dashed"}`}>
                            {actual ? trapLabels[actual] : "neuvedeno"}
                            {!matches && ` (čekáno ${trapLabels[run.expected.traps[trapId]]})`}
                          </td>
                        );
                      })}
                      <td className="px-3 py-1.5 border-b border-line">{result.unverifiedQuotes}</td>
                    </>
                  ) : (
                    <td colSpan={2 + role.rubric.length + trapIds.length + 1} className="px-3 py-1.5 border-b border-line text-ink-muted">
                      {isRunning ? "Hodnotím…" : result?.status === "failed" ? `Nepovedlo se: ${result.message}` : "Čeká"}
                    </td>
                  )}
                  <td className="px-3 py-1.5 border-b border-line">
                    <div className="flex flex-col gap-1 items-start">
                      {canRetry && result && (
                        <button type="button" onClick={() => calibration.retryCell(run.id, round)} className="text-accent underline underline-offset-4 whitespace-nowrap">
                          Ohodnotit znovu
                        </button>
                      )}
                      {/* Older results stored only a summary; those need "Ohodnotit znovu" first. */}
                      {result?.status === "done" && result.evaluation && (
                        <SaveFileButton
                          label="Stáhnout jako ukázku"
                          filename={sampleFilename(role, run, round)}
                          getContent={() => buildSampleFile(role, run, result.evaluation!)}
                          className="text-accent underline underline-offset-4 whitespace-nowrap text-left"
                        />
                      )}
                    </div>
                  </td>
                </tr>
              );
            }),
          )}
        </tbody>
      </table>
    </div>
  );
}
