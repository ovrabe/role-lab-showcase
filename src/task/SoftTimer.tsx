import { useEffect, useState } from "react";

const ringRadius = 16;
const ringLength = 2 * Math.PI * ringRadius;

// Soft limit: it only informs, never blocks. Counts from the session start, so a reload does not reset it.
export function SoftTimer({ startedAt, limitMinutes }: { startedAt: string; limitMinutes: number }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(interval);
  }, []);

  // `now` only ticks every 15 s, so right after a restart it can be older than startedAt.
  // Without the floor at zero the timer would briefly show more time than the limit.
  const elapsedMinutes = Math.max(0, (now - new Date(startedAt).getTime()) / 60_000);
  const remainingMinutes = Math.ceil(limitMinutes - elapsedMinutes);

  if (remainingMinutes <= 0) {
    return (
      <p role="status" className="text-sm bg-notice text-notice-ink rounded-full px-3 py-1">
        Doporučený čas {limitMinutes} minut uplynul. Můžeš pokračovat, nic se nezablokuje.
      </p>
    );
  }

  // The ring empties as time runs out, in the accent blue: time is information, not a warning.
  const remainingShare = Math.min(1, (limitMinutes - elapsedMinutes) / limitMinutes);
  return (
    <p className="flex items-center gap-2.5 text-sm text-ink-muted">
      <span className="relative grid place-items-center size-10" aria-hidden="true">
        <svg viewBox="0 0 40 40" className="absolute inset-0 -rotate-90">
          <circle cx="20" cy="20" r={ringRadius} fill="none" stroke="var(--color-line)" strokeWidth="3.5" />
          <circle
            cx="20"
            cy="20"
            r={ringRadius}
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeDasharray={ringLength}
            strokeDashoffset={ringLength * (1 - remainingShare)}
            className="transition-[stroke-dashoffset] duration-700"
          />
        </svg>
        <span className="text-xs font-semibold text-ink tabular-nums">{remainingMinutes}</span>
      </span>
      Zbývá asi {remainingMinutes} min z {limitMinutes}
    </p>
  );
}
