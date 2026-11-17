import { Lightbulb, Sparkles } from "lucide-react";
import type { RoleConfig } from "../roles/roleSchema";
import type { StoredEvaluation } from "../evaluation/evaluationSchema";

const dimensionName = (role: RoleConfig, id: string) =>
  role.rubric.find((dimension) => dimension.id === id)?.name ?? id;

// Strengths and next steps at the end of the result (split out of ResultDetails.tsx).
export function GrowthSection({ role, evaluation }: { role: RoleConfig; evaluation: StoredEvaluation }) {
  const { strengths, nextSteps } = evaluation.output;
  return (
    <section aria-labelledby="growth-heading" className="card space-y-4">
      <h2 id="growth-heading">
        Co ti jde a co zkusit příště
      </h2>
      {strengths.length > 0 && (
        <ul className="space-y-2">
          {strengths.map((strength) => (
            <li key={strength} className="flex gap-3">
              <Sparkles aria-hidden="true" size={18} className="shrink-0 mt-0.5 text-progress" />
              <span>{strength}</span>
            </li>
          ))}
        </ul>
      )}
      {/* Next steps as tiles with an icon, like the brief in the task. */}
      {nextSteps.map((step) => (
        <article key={`${step.dimension}-${step.title}`} className="rounded-control bg-paper p-4 flex gap-3">
          <span
            aria-hidden="true"
            className="shrink-0 grid place-items-center size-9 rounded-full bg-[color-mix(in_srgb,var(--color-progress)_14%,transparent)] text-progress"
          >
            <Lightbulb size={18} strokeWidth={2} />
          </span>
          <div className="min-w-0 space-y-1">
            <h3>{step.title}</h3>
            <p className="text-sm text-ink-muted">{dimensionName(role, step.dimension)}</p>
            <p>{step.why}</p>
            <p>
              <span className="font-semibold">Cvičení: </span>
              {step.exercise}
            </p>
          </div>
        </article>
      ))}
    </section>
  );
}
