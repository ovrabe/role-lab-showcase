import { useEffect, useRef, useState } from "react";
import { chartMilestones, prototypeEnd, workingDays } from "./makingOfContent";

// Cumulative active hours over the working days, milestones on the curve. The prototype
// phase is drawn strong and the rest light (the author's choice): the prototype was already
// a working product, everything after it extended and polished it.
// The SVG takes the real width of its box (not a fixed viewBox scaled down), so the labels
// stay 12–13 px on a phone instead of shrinking with the drawing.

const plotTop = 48; // room for the last label above the end of the curve
const sidePadding = 12;

// A phone gets a taller plot and its own label rows, otherwise the labels of the early
// milestones would overlap. Rows are text baselines, last milestone first.
const layouts = {
  wide: { plotBottom: 180, rows: [[14, 30], [64, 80], [100, 116], [64, 80]] },
  narrow: { plotBottom: 220, rows: [[14, 30], [60, 76], [96, 112], [132, 148]] },
};

const formatHours = (hours: number) =>
  hours < 10 ? `${(Math.round(hours * 2) / 2).toLocaleString("cs-CZ")} h` : `${Math.round(hours)} h`;

const indexOf = (month: number, day: number) => workingDays.findIndex((entry) => entry.month === month && entry.day === day);

export function DevelopmentChart() {
  const boxRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(672);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(300, Math.round(entry.contentRect.width))));
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  const isNarrow = width < 480;
  const { plotBottom, rows } = isNarrow ? layouts.narrow : layouts.wide;
  const axisY = plotBottom + 24;
  const bracketY = axisY + 12;
  const height = bracketY + 30;

  const lastIndex = workingDays.length - 1;
  const cumulative: number[] = [];
  let running = 0;
  for (const entry of workingDays) {
    running += entry.hours;
    cumulative.push(running);
  }
  const totalHours = cumulative[lastIndex];
  const totalCommits = workingDays.reduce((sum, entry) => sum + entry.commits, 0);
  const prototypeIndex = indexOf(prototypeEnd.month, prototypeEnd.day);

  // One step per working day: days without commits are left out (the author's choice),
  // the dates on the axis show when the work happened.
  const x = (index: number) => sidePadding + (index / lastIndex) * (width - 2 * sidePadding);
  const y = (hours: number) => plotBottom - (hours / totalHours) * (plotBottom - plotTop);
  const pathThrough = (from: number, to: number) =>
    cumulative
      .slice(from, to + 1)
      .map((value, offset) => `${offset === 0 ? "M" : "L"}${x(from + offset).toFixed(1)},${y(value).toFixed(1)}`)
      .join(" ");
  const areaUnder = (from: number, to: number) => `${pathThrough(from, to)} L${x(to)},${plotBottom} L${x(from)},${plotBottom} Z`;

  const firstNovemberDay = workingDays.findIndex((entry) => entry.month === 11);
  const dateLabel = (index: number) => `${workingDays[index].day}. ${workingDays[index].month}.`;

  const milestones = [...chartMilestones].reverse().map((milestone, order) => {
    const index = indexOf(milestone.month, milestone.day);
    const isFirst = milestone === chartMilestones[0];
    const isLast = order === 0;
    const hours = formatHours(cumulative[index]);
    const detail = isLast ? `${hours} · ${totalCommits} změn` : isFirst && !isNarrow ? `${hours} · plně funkční` : hours;
    return { label: milestone.label, detail, px: x(index), py: y(cumulative[index]), rows: rows[order], isFirst };
  });

  const prototypeCenter = (x(0) + x(prototypeIndex)) / 2;
  const restCenter = (x(prototypeIndex) + x(lastIndex)) / 2;

  return (
    <figure className="mb-3">
      <div ref={boxRef}>
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`Průběh vývoje: ${formatHours(totalHours)} aktivní práce ve ${workingDays.length} dnech od 30. 9. do 20. 11. 2026. Funkční prototyp po 4,5 h, úplný prototyp po ${formatHours(cumulative[prototypeIndex])}, pak rozšiřování a ladění.`}
          className="block max-w-full overflow-visible"
        >
          <line x1={x(0)} x2={x(lastIndex)} y1={plotBottom} y2={plotBottom} strokeWidth={0.5} className="stroke-ink-muted" />
          {[plotTop, (plotTop + plotBottom) / 2].map((gridY) => (
            <line key={gridY} x1={x(0)} x2={x(lastIndex)} y1={gridY} y2={gridY} strokeWidth={0.5} strokeDasharray="2 4" className="stroke-ink-muted opacity-50" />
          ))}

          <path d={areaUnder(prototypeIndex, lastIndex)} className="fill-progress opacity-15" />
          <path d={areaUnder(0, prototypeIndex)} className="fill-progress opacity-60" />
          <path d={pathThrough(prototypeIndex, lastIndex)} fill="none" strokeWidth={2} strokeLinejoin="round" className="stroke-progress opacity-70" />
          <path d={pathThrough(0, prototypeIndex)} fill="none" strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" className="stroke-progress" />
          {cumulative.map((value, index) => (
            <circle key={index} cx={x(index)} cy={y(value)} r={index <= prototypeIndex ? 3 : 2} className="fill-progress" />
          ))}

          {milestones.map((milestone) => {
            const textX = milestone.isFirst ? milestone.px - 4 : milestone.px - 8;
            const anchor = milestone.isFirst ? "start" : "end";
            return (
              <g key={milestone.label}>
                <line
                  x1={milestone.px}
                  x2={milestone.px}
                  y1={milestone.rows[1] + 6}
                  y2={milestone.py - 6}
                  strokeDasharray="2 3"
                  strokeWidth={0.5}
                  className="stroke-ink-muted"
                />
                {milestone.isFirst && <circle cx={milestone.px} cy={milestone.py} r={9} className="fill-progress opacity-25" />}
                <circle cx={milestone.px} cy={milestone.py} r={milestone.isFirst ? 5.5 : 4} className="fill-progress" />
                <text x={textX} y={milestone.rows[0]} textAnchor={anchor} className="fill-ink text-[13px] font-medium">
                  {milestone.label}
                </text>
                <text x={textX} y={milestone.rows[1]} textAnchor={anchor} className="fill-ink-muted text-xs tabular-nums">
                  {milestone.detail}
                </text>
              </g>
            );
          })}

          <text x={x(0)} y={axisY} className="fill-ink-muted text-xs">{dateLabel(0)}</text>
          <text x={x(firstNovemberDay)} y={axisY} textAnchor="middle" className="fill-ink-muted text-xs">{dateLabel(firstNovemberDay)}</text>
          <text x={x(lastIndex)} y={axisY} textAnchor="end" className="fill-ink-muted text-xs">{dateLabel(lastIndex)}</text>

          {/* Phases under the axis, strong like the prototype area, light like the rest. */}
          <rect x={x(0)} y={bracketY - 3} width={x(prototypeIndex) - x(0) - 2} height={6} rx={3} className="fill-progress" />
          <rect x={x(prototypeIndex) + 2} y={bracketY - 3} width={x(lastIndex) - x(prototypeIndex) - 2} height={6} rx={3} className="fill-progress opacity-25" />
          {/* On a phone the prototype phase is too narrow to centre its label without clipping it. */}
          <text
            x={isNarrow ? x(0) : prototypeCenter}
            y={bracketY + 20}
            textAnchor={isNarrow ? "start" : "middle"}
            className="fill-ink text-xs font-medium"
          >
            úplný prototyp · {formatHours(cumulative[prototypeIndex])}
          </text>
          <text x={restCenter} y={bracketY + 20} textAnchor="middle" className="fill-ink-muted text-xs">
            {isNarrow ? "rozšiřování a ladění" : "rozšiřování, provoz, bezpečnost a ladění"}
          </text>
        </svg>
      </div>
      <figcaption className="mt-2 text-sm text-ink-muted">
        Každý bod je den, kdy se na projektu pracovalo, a křivka ukazuje odpracované hodiny. Prototyp byl funkční produkt,
        další práce ho rozšiřovala a ladila.
      </figcaption>
    </figure>
  );
}
