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

  // One line rather than a card, so the roles below start on the first screen of a phone.
  return (
    <section aria-labelledby="daily-heading" className="mb-8 flex flex-wrap items-center gap-x-4 gap-y-2">
      <button
        type="button"
        onClick={() => onStart(challenge.id)}
        className="soft-card w-full sm:w-auto sm:flex-1 min-w-0 flex items-center gap-3 px-4 py-3 text-left border-l-4 border-l-accent hover:-translate-y-0.5 transition-transform"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-accent">
            Výzva dne · asi {challenge.minutes} minut{doneToday ? ` · hotovo ${doneToday.score} / 4` : ""}
          </span>
          <span id="daily-heading" className="block font-semibold truncate">{challenge.title}</span>
        </span>
        <span aria-hidden="true" className="text-xl">→</span>
      </button>
      {/* On a phone right under the card, so it reads as part of the daily challenge. */}
      <button
        type="button"
        onClick={onOpenMap}
        className="ml-auto sm:ml-0 inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink underline-offset-4 hover:underline"
      >
        Všechny výzvy ({totalCount})
        <span aria-hidden="true">›</span>
      </button>
    </section>
  );
}
