import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { BadgeIcon } from "./BadgeIcon";
import type { RoleConfig } from "../roles/roleSchema";
import type { StoredEvaluation } from "../evaluation/evaluationSchema";
import { attemptIndex, changesAt } from "./progress";
import { badgesAt } from "./badges";
import { loadProgress } from "./progressStorage";

type ResultProgressProps = { role: RoleConfig; evaluation: StoredEvaluation };

/**
 * "Co se změnilo" on the result (docs/PRODUCTION.md, part 10, phase 1): how this attempt
 * moved the person's skills and which badges it added. Shown only for the person's own
 * evaluations that are in their progress; samples and older results show nothing.
 */
export function ResultProgress({ role, evaluation }: ResultProgressProps) {
  const { attempts } = loadProgress();
  const index = attemptIndex(attempts, role.id, evaluation.evaluatedAt);
  if (index < 0) return null;

  const changes = changesAt(attempts, index);
  const badges = badgesAt(attempts, index);
  const nameOf = (id: string) => role.rubric.find((dimension) => dimension.id === id)?.name ?? id;

  return (
    <section aria-labelledby="progress-heading">
      <h2 id="progress-heading" className="mb-3">
        Co se změnilo
      </h2>
      <div className="card space-y-4">
        {index === 0 ? (
          <p>Tohle je tvoje první hodnocení. Od příštího pokusu tu uvidíš, jak se tvoje dovednosti posunuly.</p>
        ) : changes.length === 0 ? (
          <p>Úrovně dovedností zůstaly stejné jako minule.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {changes.map((change) => {
              const up = change.to > change.from;
              return (
                <li
                  key={change.dimension}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${
                    up ? "bg-paper text-progress" : "bg-paper text-ink-muted"
                  }`}
                >
                  {up ? <ArrowUpRight aria-hidden="true" size={16} /> : <ArrowDownRight aria-hidden="true" size={16} />}
                  {nameOf(change.dimension)} {change.from} → {change.to}
                  <span className="sr-only">{up ? "(zlepšení)" : "(pokles)"}</span>
                </li>
              );
            })}
          </ul>
        )}

        {badges.map((badge) => (
          <div key={badge.id} className="flex items-start gap-3">
            <BadgeIcon id={badge.id} />
            <span>
              <span className="block font-semibold">Nový odznak: {badge.title}</span>
              <span className="block text-sm text-ink-muted">{badge.description}</span>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
