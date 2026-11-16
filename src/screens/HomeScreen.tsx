import type { RoleConfig } from "../roles/roleSchema";
import type { RoleLoadError } from "../roles/loadRoles";
import { RoleBadge, sweepPositionFor } from "../components/RoleBadge";
import { loadSession } from "../session/sessionStorage";
import { roleStatus, taskProgress, type RoleStatus } from "../task/taskProgress";
import { ClockIcon, StatusChip } from "../components/TaskChips";
import { roleGroups } from "../roles/roleGroups";
import { ProgressTeaser } from "../progress/ProgressTeaser";
import { DailyChallengeCard } from "../challenges/DailyChallengeCard";
import type { ChallengeConfig } from "../challenges/challengeSchema";
import { useState } from "react";
import { MessageSquare } from "lucide-react";
import { FeedbackDialog } from "../components/FeedbackDialog";
import { isWebBuild } from "../buildFlags";

type HomeScreenProps = {
  activeRoles: RoleConfig[];
  errors: RoleLoadError[];
  onSelectRole: (roleId: string) => void;
  onOpenMethodology: () => void;
  onOpenTour: () => void;
  // Only in the web version, which has the "O projektu" page.
  onOpenAbout?: () => void;
  onOpenProfile: () => void;
  challenges: ChallengeConfig[];
  dailyChallenge: ChallengeConfig | null;
  onSelectChallenge: (challengeId: string) => void;
  onOpenChallengeMap: () => void;
};

export function HomeScreen({
  activeRoles,
  errors,
  onSelectRole,
  onOpenMethodology,
  onOpenTour,
  onOpenAbout,
  onOpenProfile,
  challenges,
  dailyChallenge,
  onSelectChallenge,
  onOpenChallengeMap,
}: HomeScreenProps) {
  const roleCards = roleGroups(activeRoles);
  const [isSuggestionOpen, setIsSuggestionOpen] = useState(false);
  return (
    <section className="max-w-2xl mx-auto">
      <HomeHero onOpenTour={onOpenTour} onOpenMethodology={onOpenMethodology} onOpenAbout={onOpenAbout} />

      {errors.length > 0 && <ConfigErrors errors={errors} />}

      <ProgressTeaser roles={activeRoles} onOpenProfile={onOpenProfile} />

      <DailyChallengeCard
        challenge={dailyChallenge}
        totalCount={challenges.length}
        onStart={onSelectChallenge}
        onOpenMap={onOpenChallengeMap}
      />

      <h2 className="mb-3">Vyber si roli</h2>
      {activeRoles.length === 0 && (
        <p className="text-ink-muted mb-8">
          Zatím není dostupná žádná role. Autor stránky ji musí zapnout v konfiguraci.
        </p>
      )}
      <ul className="space-y-3 mb-10">
        {roleCards.map(({ role, tasks }, index) => (
          <li key={role.roleId}>
            <button
              type="button"
              onClick={() => onSelectRole(role.roleId)}
              className="soft-card w-full text-left p-5 flex items-start gap-4 transition-transform hover:-translate-y-0.5"
            >
              <RoleBadge title={role.title} sweepPosition={sweepPositionFor(index, roleCards.length)} />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-lg">{role.title}</span>
                <span className="block text-ink-muted">{role.context}</span>
                <span className="mt-3 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-paper px-3 py-1 text-sm text-ink-muted">
                    <ClockIcon />
                    {taskCountLabel(tasks.length)}
                  </span>
                  <StatusChip status={combinedStatus(tasks)} />
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      {/* Instead of a list of roles "coming soon": ask which role is missing. The answer
          lands in the author's backlog. The form needs the server, so web version only. */}
      {isWebBuild && (
        <>
          <button
            type="button"
            onClick={() => setIsSuggestionOpen(true)}
            className="inline-flex items-center gap-2 text-ink-muted hover:text-ink underline-offset-4 hover:underline"
          >
            <MessageSquare aria-hidden="true" size={16} />
            Chybí ti tvoje role? Napiš autorovi
          </button>
          <FeedbackDialog open={isSuggestionOpen} page="home-role" onClose={() => setIsSuggestionOpen(false)} />
        </>
      )}
    </section>
  );
}

// Opening banner in the AI colour sweep (docs/SPEC.md, section 9). The heading and
// intro sit on the dark part; the coloured shapes are pinned to the bottom edge at a
// fixed aspect ratio, so on any width they stay under the text, never behind it.
// Inline SVG, so nothing is downloaded.
function HomeHero({ onOpenTour, onOpenMethodology, onOpenAbout }: { onOpenTour: () => void; onOpenMethodology: () => void; onOpenAbout?: () => void }) {
  return (
    <div className="relative overflow-hidden rounded-card mb-10 bg-linear-to-br from-[#241d5c] via-[#3a2a8a] to-[#5a37b8]">
      <svg
        viewBox="0 0 640 360"
        preserveAspectRatio="xMaxYMax meet"
        aria-hidden="true"
        className="absolute bottom-0 right-0 w-full h-auto"
      >
        <defs>
          <linearGradient id="home-hero-sweep" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="#ff7a45" />
            <stop offset="0.45" stopColor="#e5489b" />
            <stop offset="1" stopColor="#8a5cf6" />
          </linearGradient>
          <radialGradient id="home-hero-orb" cx="0.35" cy="0.35" r="0.7">
            <stop offset="0" stopColor="#ffb199" />
            <stop offset="0.5" stopColor="#e5489b" />
            <stop offset="1" stopColor="#3d7bff" />
          </radialGradient>
        </defs>
        <path d="M0 360 C160 340 260 270 400 270 S580 200 640 150 L640 360 Z" fill="url(#home-hero-sweep)" />
        <path d="M0 360 C200 355 330 315 470 322 S600 320 640 290 L640 360 Z" fill="#ff7a45" opacity="0.55" />
        <circle cx="560" cy="330" r="130" fill="url(#home-hero-orb)" opacity="0.85" />
      </svg>
      <div className="relative px-6 pt-8 pb-40 sm:px-10 sm:pt-12 sm:pb-44 max-w-xl text-white">
        <h1 className="mb-4">Práce s AI na úkolu z praxe</h1>
        <p className="text-white/85">
          S pomocí AI asistenta vyřešíš pracovní úkol, jaký se ve tvé roli běžně dělá. Potom uvidíš hodnocení výsledku i postupu. Každé
          skóre je doložené citací a konečné slovo má člověk.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          {/* The one solid button: for anyone who wants to see how it works before spending 15 minutes. */}
          <button type="button" onClick={onOpenTour} className="rounded-full bg-white text-[#241d5c] px-4 py-2 font-semibold hover:bg-white/90">
            Prohlídka na 2 minuty
          </button>
          <button type="button" onClick={onOpenMethodology} className={heroButtonClass}>
            Jak hodnotíme
          </button>
          {onOpenAbout && (
            <button type="button" onClick={onOpenAbout} className={heroButtonClass}>
              O projektu
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const heroButtonClass =
  "rounded-full bg-white/15 border border-white/30 px-4 py-2 text-white font-medium hover:bg-white/25";

function ConfigErrors({ errors }: { errors: RoleLoadError[] }) {
  return (
    <div role="alert" className="bg-notice text-notice-ink border border-line rounded-control p-4 mb-8">
      <p className="font-semibold mb-2">Některé role se nepodařilo načíst. Oprav jejich konfiguraci a sestav stránku znovu.</p>
      <ul className="space-y-2">
        {errors.map((error) => (
          <li key={error.file}>
            <code className="font-semibold">{error.file}</code>
            <ul className="list-disc pl-6">
              {error.problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Czech plural: 1 úkol, 2–4 úkoly, 5 and more úkolů.
function taskCountLabel(count: number): string {
  if (count === 1) return "1 úkol";
  return count >= 2 && count <= 4 ? `${count} úkoly` : `${count} úkolů`;
}

// Unfinished work wins: one started task is enough to show "Rozpracováno" on the role.
function combinedStatus(tasks: RoleConfig[]): RoleStatus {
  const statuses = tasks.map((task) => roleStatus(taskProgress(loadSession(task.id))));
  if (statuses.includes("inProgress")) return "inProgress";
  return statuses.includes("submitted") ? "submitted" : "new";
}
