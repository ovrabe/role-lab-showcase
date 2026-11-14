import type { RoleConfig } from "../roles/roleSchema";

const formatThreshold = (value: number) => value.toLocaleString("cs-CZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// The public rubric of one role (docs/SPEC.md, sections 4.6 and 5): dimensions with their
// level descriptions, the level thresholds and the cap rule, all read from the role config.
export function RoleRubric({ role }: { role: RoleConfig }) {
  const levels = [...role.levels].sort((a, b) => a.level - b.level);

  return (
    <>
      <h2 className="mb-3">Pět oblastí</h2>
      <p className="mb-4">
        Každou oblast hodnotíme na stupnici 1 až 4. Každé skóre musí být doložené citací z konverzace nebo z
        odevzdaného výsledku.
      </p>
      <div className="mb-8 space-y-4">
        {role.rubric.map((dimension) => (
          <section key={dimension.id} aria-labelledby={`rubric-${dimension.id}`} className="card">
            <h3 id={`rubric-${dimension.id}`}>
              {dimension.name}
            </h3>
            <p className="text-ink-muted mb-3">{dimension.question}</p>
            <ol className="space-y-1.5">
              {(["1", "2", "3", "4"] as const).map((score) => (
                <li key={score} className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-2">
                  <span className="font-semibold tabular-nums text-progress">{score}</span>
                  <span>{dimension.anchors[score]}</span>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>

      <h2 className="mb-3">Jak vzniká celková úroveň</h2>
      <p className="mb-4">
        Celkovou úroveň nepočítá model, ale pevná pravidla v aplikaci. Díky tomu jsou průhledná a nemění se s
        náladou modelu.
      </p>
      <div className="card mb-8">
        <p className="mb-3">Spočítá se průměr pěti skóre a podle těchto prahů se převede na úroveň:</p>
        {/* Same layout as the scores above: the number is a value (level 1), so no dot. */}
        <ol className="mb-4 space-y-1.5">
          {levels.map((level, index) => (
            <li key={level.level} className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-2">
              <span className="font-semibold tabular-nums text-progress">{level.level}</span>
              <span>
                <span className="font-semibold">{level.label}</span>{" "}
                <span className="text-ink-muted tabular-nums">
                  {/* The lowest level has threshold 0, so it is described by where the next level starts. */}
                  {level.minAverage === 0 && levels[index + 1]
                    ? `pod průměrem ${formatThreshold(levels[index + 1].minAverage)}`
                    : `od průměru ${formatThreshold(level.minAverage)}`}
                </span>
                : {level.description}
              </span>
            </li>
          ))}
        </ol>
        {/* The config's own wording states the rule and the reason in full. */}
        <p className="rounded-control bg-notice text-notice-ink px-4 py-3">
          <span className="font-semibold">Platí strop:</span> {role.capRule.description}
        </p>
      </div>
    </>
  );
}
