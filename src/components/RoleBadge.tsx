// Initials on a tile of the colour sweep. Each role takes a different part of the
// sweep by its order in the config, so no role is styled by name.
export function sweepPositionFor(index: number, count: number): number {
  return count > 1 ? (index / (count - 1)) * 100 : 0;
}

export function RoleBadge({ title, sweepPosition, size = "md" }: { title: string; sweepPosition: number; size?: "sm" | "md" | "lg" }) {
  const initials = title
    .split(/\s+/)
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span
      aria-hidden="true"
      className={`shrink-0 rounded-control grid place-items-center text-white font-semibold ${size === "lg" ? "size-14 text-lg" : size === "sm" ? "size-9 text-sm" : "size-12"}`}
      style={{ backgroundImage: "var(--ai-sweep)", backgroundSize: "300% 100%", backgroundPosition: `${sweepPosition}% 0` }}
    >
      {initials}
    </span>
  );
}
