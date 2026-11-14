import { ArrowRight } from "lucide-react";
import type { DimensionId, RoleConfig } from "../roles/roleSchema";
import type { SkillLevels } from "./progress";

/** The five skills as bars with their level; the recommended one is marked. */
export function SkillBars({ role, levels, focus }: { role: RoleConfig; levels: SkillLevels; focus: DimensionId | null }) {
  return (
    <div className="card">
      <ul className="grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)_3.5rem] sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)_3.5rem] items-center gap-x-4 gap-y-3">
        {role.rubric.map((dimension) => {
          const level = levels[dimension.id];
          return (
            <li key={dimension.id} className="contents">
              <span className="text-sm min-w-0">
                {dimension.name}
                {dimension.id === focus && (
                  <span className="ml-2 inline-block rounded-full bg-paper px-2 py-0.5 text-xs font-medium text-progress">
                    doporučeno
                  </span>
                )}
              </span>
              <span className="h-1.5 rounded-full bg-track overflow-hidden" aria-hidden="true">
                <span
                  className="rl-bar-in block h-full rounded-full bg-[image:var(--progress-sweep)]"
                  style={{ width: `${((level ?? 0) / 4) * 100}%` }}
                />
              </span>
              <span className="text-sm tabular-nums text-right text-ink-muted">{level ? `${level} ze 4` : "–"}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** What to practise next: the weakest skill with the matching exercise from the role config. */
export function NextStepCard({
  role,
  focus,
  onSelectRole,
}: {
  role: RoleConfig;
  focus: DimensionId;
  onSelectRole: (roleId: string) => void;
}) {
  const focusName = role.rubric.find((dimension) => dimension.id === focus)?.name ?? focus;
  return (
    <div className="card">
      <p className="text-sm text-ink-muted mb-1">Doporučený další krok · {role.title}</p>
      {/* "Trénuj: Iterace" needs no declension, unlike "Zaměř se na iteraci". */}
      <p className="font-semibold mb-2">Trénuj: {focusName}</p>
      <p className="mb-4">{role.microExercises[focus]}</p>
      <button
        type="button"
        onClick={() => onSelectRole(role.id)}
        className="inline-flex items-center gap-2 rounded-full bg-action text-action-contrast px-5 py-2 font-semibold"
      >
        Otevřít úkol
        <ArrowRight aria-hidden="true" size={16} />
      </button>
    </div>
  );
}
