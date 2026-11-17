import { MessageSquareQuote } from "lucide-react";
import tips from "../../data/tips.json";
import type { RoleConfig } from "../roles/roleSchema";
import type { StoredEvaluation } from "../evaluation/evaluationSchema";

type TipDimension = "framing" | "decomposition" | "verification" | "iteration" | "judgment";

/**
 * The weakest area: the lowest score, the first in rubric order on a tie. None when every
 * area scored 4, then there is nothing to practise and no tips are shown.
 */
export function weakestDimension(role: RoleConfig, evaluation: StoredEvaluation): TipDimension | null {
  const scores = new Map(evaluation.output.dimensions.map((dimension) => [dimension.id, dimension.score]));
  let weakest: { id: TipDimension; score: number } | null = null;
  for (const { id } of role.rubric) {
    const score = scores.get(id);
    if (score !== undefined && score < 4 && (weakest === null || score < weakest.score)) weakest = { id: id as TipDimension, score };
  }
  return weakest?.id ?? null;
}

/** Example prompts for the weakest area (data/tips.json): what a better request to the AI looks like. */
export function PromptTips({ role, evaluation }: { role: RoleConfig; evaluation: StoredEvaluation }) {
  const dimension = weakestDimension(role, evaluation);
  if (!dimension) return null;
  const name = role.rubric.find((candidate) => candidate.id === dimension)?.name ?? dimension;
  return (
    <section aria-labelledby="tips-heading" className="card space-y-4">
      <div>
        <h2 id="tips-heading">Tahák: jak zadávat AI v oblasti {name}</h2>
        <p className="text-ink-muted">Ukázky formulací, které můžeš příště upravit a použít. Hranaté závorky nahraď svým obsahem.</p>
      </div>
      <ul className="space-y-2">
        {tips[dimension].map((tip) => (
          <li key={tip} className="rounded-control bg-paper p-3 flex gap-3">
            <MessageSquareQuote aria-hidden="true" size={18} className="shrink-0 mt-0.5 text-progress" />
            <span>{tip}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
