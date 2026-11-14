// The three pass criteria from docs/SPEC.md, M3.5, computed from finished results.
// Pure functions: no React, no storage, so they can be tested on their own.

export type TrapStatus = "caught" | "partial" | "missed";

export type CalibrationRunSpec = {
  id: string;
  label: string;
  expected: { rank: number; traps: Record<string, TrapStatus> };
};

export type CalibrationCell = {
  runId: string;
  round: number;
  level: number;
  average: number;
  traps: Record<string, TrapStatus>;
};

export type CriterionVerdict = { passed: boolean | null; details: string[] };

const formatAverage = (value: number) => value.toFixed(1).replace(".", ",");

/** 1. In every complete round the averages rise strictly from weak to strong. */
export function checkOrder(runs: CalibrationRunSpec[], cells: CalibrationCell[], rounds: number): CriterionVerdict {
  const ordered = [...runs].sort((a, b) => a.expected.rank - b.expected.rank);
  const details: string[] = [];
  let checkedRounds = 0;
  let passed = true;
  for (let round = 1; round <= rounds; round++) {
    const roundCells = ordered.map((run) => cells.find((cell) => cell.runId === run.id && cell.round === round));
    if (roundCells.some((cell) => cell === undefined)) continue;
    checkedRounds++;
    const averages = roundCells.map((cell) => cell!.average);
    const isRising = averages.every((average, index) => index === 0 || average > averages[index - 1]);
    if (!isRising) passed = false;
    details.push(`Kolo ${round}: ${averages.map(formatAverage).join(" < ")}${isRising ? "" : " (pořadí nesedí)"}`);
  }
  // A wrong order fails at once; a pass needs every round finished.
  if (!passed) return { passed: false, details };
  if (checkedRounds < rounds) return { passed: null, details };
  return { passed: true, details };
}

/** 2. Every evaluated trap status matches the intent of its run. */
export function checkTraps(runs: CalibrationRunSpec[], cells: CalibrationCell[]): CriterionVerdict {
  const details: string[] = [];
  for (const cell of cells) {
    const run = runs.find((candidate) => candidate.id === cell.runId);
    if (!run) continue;
    for (const [trapId, expected] of Object.entries(run.expected.traps)) {
      const actual = cell.traps[trapId] ?? "neuvedeno";
      if (actual !== expected) details.push(`${run.label}, kolo ${cell.round}: ${trapId} je ${actual}, čekáno ${expected}`);
    }
  }
  return { passed: cells.length === 0 ? null : details.length === 0, details };
}

/** 3. The level of the same run differs by at most one between rounds. */
export function checkStability(runs: CalibrationRunSpec[], cells: CalibrationCell[]): CriterionVerdict {
  const details: string[] = [];
  let passed = true;
  let anyChecked = false;
  for (const run of runs) {
    const levels = cells.filter((cell) => cell.runId === run.id).map((cell) => cell.level);
    if (levels.length < 2) continue;
    anyChecked = true;
    const spread = Math.max(...levels) - Math.min(...levels);
    if (spread > 1) passed = false;
    details.push(`${run.label}: úrovně ${levels.join(", ")}${spread > 1 ? " (rozptyl víc než 1)" : ""}`);
  }
  return { passed: anyChecked ? passed : null, details };
}
