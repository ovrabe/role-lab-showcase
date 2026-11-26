import { useId, type ReactNode } from "react";
import { CircleAlert, CircleCheck, TriangleAlert } from "lucide-react";

// Building blocks of the admin overview in the app's look: white cards with large corners,
// the violet progress sweep for data, status always with an icon and a word, never colour alone.

export const cardClass = "rounded-[24px] bg-surface p-6 shadow-[var(--shadow-card)] min-w-0";

/** A line of points for the last days, oldest first; scaled to its own maximum. */
export function Sparkline({ values }: { values: number[] }) {
  // Each sparkline its own gradient id: four with the same id would be invalid HTML.
  const gradientId = `spark-${useId().replace(/:/g, "")}`;
  const max = Math.max(1, ...values);
  const step = values.length > 1 ? 120 / (values.length - 1) : 0;
  const points = values.map((value, index) => `${Math.round(index * step)},${Math.round(30 - (value / max) * 26)}`).join(" ");
  return (
    <svg viewBox="0 0 120 32" className="w-full h-8" aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#8a5cf6" />
          <stop offset="1" stopColor="#5b6cff" />
        </linearGradient>
      </defs>
      {values.length > 1 && <polyline points={points} fill="none" stroke={`url(#${gradientId})`} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  );
}

/** A big number with its change against the previous period and a sparkline. */
export function KpiCard({ label, value, changePercent, note, values }: { label: string; value: ReactNode; changePercent: number | null; note?: string; values: number[] }) {
  const trend =
    changePercent === null ? (note ?? "bez srovnání") : changePercent === 0 ? "beze změny" : `${changePercent > 0 ? "↑" : "↓"} ${Math.abs(changePercent)} % proti minulému období`;
  return (
    <div className={`${cardClass} flex flex-col gap-1`}>
      <p className="text-sm text-ink-muted">{label}</p>
      <p className="text-4xl font-bold tracking-tight tabular-nums">{value}</p>
      <p className="text-sm font-semibold text-ink-muted">{trend}</p>
      <Sparkline values={values} />
    </div>
  );
}

/** A bar on the track, in the progress sweep, as wide as its share. */
export function SweepBar({ share, height = "h-2" }: { share: number; height?: string }) {
  return (
    <div className={`${height} rounded-full bg-track`}>
      <div className={`${height} rounded-full bg-[image:var(--progress-sweep)]`} style={{ width: `${Math.max(0, Math.min(1, share)) * 100}%` }} />
    </div>
  );
}

export type Health = "ok" | "warning" | "critical" | "idle";

/** One row of "Zdraví provozu": a status with an icon and its word, the name and the details. */
export function HealthRow({ name, detail, health }: { name: string; detail: string; health: Health }) {
  const icon =
    health === "ok" ? <CircleCheck aria-hidden="true" size={18} className="text-[#1f8a4c]" /> : health === "warning" ? <TriangleAlert aria-hidden="true" size={18} className="text-[#b07400]" /> : health === "critical" ? <CircleAlert aria-hidden="true" size={18} className="text-[#c0362c]" /> : <CircleCheck aria-hidden="true" size={18} className="text-ink-muted" />;
  const word = { ok: "v pořádku", warning: "pozor", critical: "problém", idle: "bez provozu" }[health];
  return (
    // A long detail (the BotID verdicts) moves under the name instead of squeezing it.
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[16px] bg-paper px-3 py-2.5">
      {icon}
      <span className="flex-1 basis-36 text-sm font-semibold">
        {name} <span className="font-normal text-ink-muted">· {word}</span>
      </span>
      <span className="ml-auto text-sm text-ink-muted tabular-nums text-right">{detail}</span>
    </div>
  );
}
