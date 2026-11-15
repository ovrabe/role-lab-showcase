import { skillNames } from "../roles/skillNames";
import type { ChallengeConfig } from "./challengeSchema";
import { loadChallengeProgress } from "./challengeProgress";
import { pragueDay } from "./dailyChallenge";

type DailyChallengeCardProps = {
  challenge: ChallengeConfig | null;
  totalCount: number;
  onStart: (challengeId: string) => void;
  onOpenMap: () => void;
};

/** The home page's offer of a few minutes of practice: today's challenge and the way to all of them. */
export function DailyChallengeCard({ challenge, totalCount, onStart, onOpenMap }: DailyChallengeCardProps) {
  if (!challenge) return null;
  const today = pragueDay(new Date());
  const doneToday = loadChallengeProgress().records.find(
    (record) => record.challengeId === challenge.id && pragueDay(new Date(record.completedAt)) === today,
  );

  return (
    <section aria-labelledby="daily-heading" className="card mb-10 space-y-3 border-l-4 border-l-accent">
      <p className="text-sm font-semibold text-accent">Výzva dne · {skillNames[challenge.skill]} · asi {challenge.minutes} minut</p>
      <h2 id="daily-heading">{challenge.title}</h2>
      {doneToday ? (
        <p className="text-ink-muted">Dnes hotovo se skóre {doneToday.score} / 4. Zítra čeká jiná výzva.</p>
      ) : (
        <p className="text-ink-muted">Přečti si situaci, posuď výstup AI a napiš krátkou odpověď. Hodnocení přijde hned.</p>
      )}
      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          onClick={() => onStart(challenge.id)}
          className={doneToday ? "rounded-full border border-line px-5 py-2 font-semibold" : "rl-submit-sweep rounded-full px-6 py-2.5 font-semibold"}
        >
          {doneToday ? "Zkusit znovu" : "Začít výzvu"}
        </button>
        <button type="button" onClick={onOpenMap} className="rounded-full border border-line px-5 py-2">
          Všechny výzvy ({totalCount})
        </button>
      </div>
    </section>
  );
}
