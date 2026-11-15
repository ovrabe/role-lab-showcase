import { useEffect } from "react";
import { dimensionIds } from "../roles/roleSchema";
import { skillNames } from "../roles/skillNames";
import type { ChallengeConfig } from "../challenges/challengeSchema";
import { bestScores, loadChallengeProgress } from "../challenges/challengeProgress";

type ChallengeMapScreenProps = {
  challenges: ChallengeConfig[];
  dailyChallengeId: string | null;
  onSelect: (challengeId: string) => void;
};

/** All short challenges by skill, each with its best score so far (phase 2d). */
export function ChallengeMapScreen({ challenges, dailyChallengeId, onSelect }: ChallengeMapScreenProps) {
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);
  const best = bestScores(loadChallengeProgress().records);
  const doneCount = challenges.filter((challenge) => best[challenge.id] !== undefined).length;

  return (
    <article className="max-w-3xl mx-auto space-y-8">
      <header>
        <h1>Krátké výzvy</h1>
        <p className="text-ink-muted mt-1">
          Pět minut na jednu dovednost. Hotovo {doneCount} z {challenges.length}. Výsledky výzev se ukládají jen v tomto
          prohlížeči a úroveň dovedností v profilu nemění, tu určují celé úkoly.
        </p>
      </header>

      {dimensionIds.map((skill) => {
        const ofSkill = challenges.filter((challenge) => challenge.skill === skill);
        if (ofSkill.length === 0) return null;
        return (
          <section key={skill} aria-labelledby={`map-${skill}`}>
            <h2 id={`map-${skill}`} className="mb-3">
              {skillNames[skill]}
            </h2>
            <ul className="grid gap-3 sm:grid-cols-3">
              {ofSkill.map((challenge) => (
                <li key={challenge.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(challenge.id)}
                    className="soft-card w-full h-full text-left p-4 flex flex-col gap-2 transition-transform hover:-translate-y-0.5"
                  >
                    <span className="font-semibold">{challenge.title}</span>
                    <span className="mt-auto flex flex-wrap items-center gap-2 text-sm">
                      <ScoreChip score={best[challenge.id]} />
                      {challenge.id === dailyChallengeId && (
                        <span className="rounded-full bg-paper px-2.5 py-0.5 font-semibold text-accent">Výzva dne</span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </article>
  );
}

function ScoreChip({ score }: { score: number | undefined }) {
  if (score === undefined) return <span className="rounded-full bg-paper px-2.5 py-0.5 text-ink-muted">Nezkoušeno</span>;
  return (
    <span className="rounded-full bg-paper px-2.5 py-0.5 font-semibold tabular-nums">
      Nejlépe {score} / 4
    </span>
  );
}
