import type { ReactNode } from "react";

// Small building blocks of the admin page: a number tile, a bar chart by day and a table.
// One series per chart in the project's progress colour, so no legend is needed; every bar
// carries its exact value as a tooltip and every chart has a table next to it.

export function StatTile({ label, value, note }: { label: string; value: ReactNode; note?: string }) {
  return (
    <div className="card">
      <p className="text-sm text-ink-muted">{label}</p>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      {note && <p className="text-xs text-ink-muted mt-1">{note}</p>}
    </div>
  );
}

const shortDay = (day: string) => `${Number(day.slice(8))}. ${Number(day.slice(5, 7))}.`;

/** Bars per day, oldest on the left. format turns a value into its label (dollars, counts). */
export function DayBars({ title, points, format = String }: { title: string; points: { day: string; value: number }[]; format?: (value: number) => string }) {
  const width = 640;
  const height = 120;
  const max = Math.max(1, ...points.map((point) => point.value));
  const slot = width / Math.max(points.length, 1);
  const barWidth = Math.max(2, slot - 2);
  const total = points.reduce((sum, point) => sum + point.value, 0);
  return (
    <figure className="card space-y-2">
      <figcaption className="flex justify-between text-sm">
        <span className="font-semibold">{title}</span>
        <span className="text-ink-muted tabular-nums">celkem {format(total)}</span>
      </figcaption>
      <svg viewBox={`0 0 ${width} ${height + 18}`} className="w-full h-auto" role="img" aria-label={`${title}: celkem ${format(total)}`}>
        <line x1="0" x2={width} y1={height} y2={height} stroke="var(--color-line)" strokeWidth="1" />
        {points.map((point, index) => {
          const barHeight = point.value === 0 ? 0 : Math.max(3, (point.value / max) * (height - 4));
          const x = index * slot + 1;
          return (
            <g key={point.day}>
              {/* A taller invisible target, so a thin bar is still easy to hover. */}
              <rect x={x} y={0} width={barWidth} height={height} fill="transparent">
                <title>{`${shortDay(point.day)}: ${format(point.value)}`}</title>
              </rect>
              {barHeight > 0 && (
                <path
                  d={`M${x},${height} V${height - barHeight + 4} q0,-4 4,-4 h${Math.max(0, barWidth - 8)} q4,0 4,4 V${height} Z`}
                  fill="var(--color-progress)"
                  pointerEvents="none"
                />
              )}
            </g>
          );
        })}
        {points.length > 0 && (
          <>
            <text x="0" y={height + 14} fontSize="11" fill="var(--color-ink-muted)">{shortDay(points[0].day)}</text>
            <text x={width} y={height + 14} fontSize="11" fill="var(--color-ink-muted)" textAnchor="end">{shortDay(points[points.length - 1].day)}</text>
          </>
        )}
      </svg>
    </figure>
  );
}

export function DataTable({ head, rows, empty = "Zatím žádná data." }: { head: string[]; rows: ReactNode[][]; empty?: string }) {
  if (rows.length === 0) return <p className="card text-sm text-ink-muted">{empty}</p>;
  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-left text-sm tabular-nums">
        <thead>
          <tr>
            {head.map((cell, index) => (
              <th key={index} className="pr-4 pb-2 font-medium text-ink-muted whitespace-nowrap">{cell}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-t border-line align-top">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="pr-4 py-1.5">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const usd = (value: number) => `${value.toFixed(2).replace(".", ",")} $`;
export const count = (value: number) => value.toLocaleString("cs-CZ");
export const percent = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)} %` : "–");
