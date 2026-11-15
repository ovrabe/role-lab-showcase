import type { RoleStatus } from "../task/taskProgress";

// Tells the person that unfinished work is waiting, so leaving a task never feels like losing it.
export function StatusChip({ status }: { status: RoleStatus }) {
  if (status === "new") return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_srgb,var(--color-accent)_12%,transparent)] px-3 py-1 text-sm font-semibold text-accent">
      <span aria-hidden="true" className="size-1.5 rounded-full bg-accent" />
      {status === "inProgress" ? "Rozpracováno" : "Odevzdáno"}
    </span>
  );
}

export function ClockIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="8" r="6.25" />
      <path d="M8 4.75V8l2.25 1.5" strokeLinecap="round" />
    </svg>
  );
}
