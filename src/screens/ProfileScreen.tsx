import { Lock } from "lucide-react";
import type { RoleConfig } from "../roles/roleSchema";
import { allBadges, badgeGroups, earnedBadges, trainingDays } from "../progress/badges";
import { AvatarCard } from "../profile/AvatarCard";
import { BadgeIcon } from "../progress/BadgeIcon";
import { recommendedSkill, skillLevels } from "../progress/progress";
import { loadProgress } from "../progress/progressStorage";
import { NextStepCard, SkillBars } from "../progress/SkillsPanel";

type ProfileScreenProps = { roles: RoleConfig[]; onSelectRole: (roleId: string) => void };

/**
 * "Můj profil" (docs/PRODUCTION.md, part 10, phase 1): skills, the next step, all badges
 * (the ones still to earn as goals) and the history of attempts. Everything comes from the
 * progress kept in this browser.
 */
export function ProfileScreen({ roles, onSelectRole }: ProfileScreenProps) {
  const { attempts } = loadProgress();
  const latest = attempts[attempts.length - 1];
  // The latest role still offered; otherwise any role, for the skill names and exercises.
  const role = roles.find((candidate) => candidate.id === latest?.roleId) ?? roles[0];
  const levels = skillLevels(attempts);
  const focus = recommendedSkill(levels);
  const earned = new Set(earnedBadges(attempts).map((badge) => badge.id));
  const roleTitle = (roleId: string) => roles.find((candidate) => candidate.id === roleId)?.title ?? roleId;
  const levelLabel = (roleId: string, level: number) =>
    roles.find((candidate) => candidate.id === roleId)?.levels.find((item) => item.level === level)?.label;

  return (
    <article className="max-w-2xl mx-auto space-y-10">
      <div>
        <h1 className="mb-2">Můj profil</h1>
        <p className="text-ink-muted">Pokrok se ukládá jen v tomhle prohlížeči. Nikdo jiný ho nevidí.</p>
      </div>

      <AvatarCard
        earnedBadgeIds={earned}
        badgeCount={earned.size}
        badgeTotal={allBadges.length}
        attemptCount={attempts.length}
        dayCount={trainingDays(attempts)}
      />

      <section aria-labelledby="skills-heading">
        <h2 id="skills-heading" className="mb-3">
          Tvoje dovednosti
        </h2>
        {latest && role ? (
          <div className="space-y-3">
            <SkillBars role={role} levels={levels} focus={focus} />
            {focus && <NextStepCard role={role} focus={focus} onSelectRole={onSelectRole} />}
          </div>
        ) : (
          <p className="card text-ink-muted">
            Po prvním hodnocení tu uvidíš, jak na tom jsi v pěti dovednostech práce s AI, a co trénovat dál.
          </p>
        )}
      </section>

      <section aria-labelledby="badges-heading">
        <h2 id="badges-heading" className="mb-3">
          Odznaky {earned.size} z {allBadges.length}
        </h2>
        <div className="space-y-5">
          {badgeGroups.map((group) => (
            <div key={group.id}>
              <h3 className="text-sm font-semibold text-ink-muted mb-2">{group.title}</h3>
              <ul className="grid gap-2 sm:grid-cols-2">
                {allBadges
                  .filter((badge) => badge.group === group.id)
                  .map((badge) => {
                    const isEarned = earned.has(badge.id);
                    return (
                      <li key={badge.id} className={`card !p-3 flex items-start gap-3 ${isEarned ? "" : "opacity-60"}`}>
                        {isEarned ? (
                          <BadgeIcon id={badge.id} />
                        ) : (
                          <span aria-hidden="true" className="shrink-0 grid place-items-center size-9 rounded-full bg-paper text-ink-muted">
                            <Lock size={16} />
                          </span>
                        )}
                        <span>
                          <span className="block font-semibold">
                            {badge.title}
                            {!isEarned && <span className="sr-only"> (zatím nezískaný)</span>}
                          </span>
                          <span className="block text-sm text-ink-muted">{badge.description}</span>
                        </span>
                      </li>
                    );
                  })}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="history-heading">
        <h2 id="history-heading" className="mb-3">
          Historie pokusů
        </h2>
        {attempts.length === 0 ? (
          <p className="card text-ink-muted">Zatím tu nic není. Hodnocení každého pokusu se sem zapíše.</p>
        ) : (
          <ul className="card divide-y divide-line">
            {[...attempts].reverse().map((attempt) => (
              <li key={`${attempt.roleId}-${attempt.evaluatedAt}`} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-3 first:pt-0 last:pb-0">
                <span className="tabular-nums text-ink-muted w-24">
                  {new Date(attempt.evaluatedAt).toLocaleDateString("cs-CZ")}
                </span>
                <span className="flex-1 min-w-0">{roleTitle(attempt.roleId)}</span>
                <span className="font-semibold tabular-nums">
                  Úroveň {attempt.level}
                  {levelLabel(attempt.roleId, attempt.level) && (
                    <span className="font-normal text-ink-muted"> · {levelLabel(attempt.roleId, attempt.level)}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </article>
  );
}
