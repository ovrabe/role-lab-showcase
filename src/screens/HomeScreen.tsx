import type { RoleConfig } from "../roles/roleSchema";
import type { RoleLoadError } from "../roles/loadRoles";
import { RoleBadge, sweepPositionFor } from "../components/RoleBadge";
import { loadSession } from "../session/sessionStorage";
import { roleStatus, taskProgress, type RoleStatus } from "../task/taskProgress";
import { ProgressTeaser } from "../progress/ProgressTeaser";

type HomeScreenProps = {
  activeRoles: RoleConfig[];
  upcomingRoleTitles: string[];
  errors: RoleLoadError[];
  onSelectRole: (roleId: string) => void;
  onOpenMethodology: () => void;
  // Only in the web version, which has the "O projektu" page.
  onOpenAbout?: () => void;
  onOpenProfile: () => void;
};

export function HomeScreen({
  activeRoles,
  upcomingRoleTitles,
  errors,
  onSelectRole,
  onOpenMethodology,
  onOpenAbout,
  onOpenProfile,
}: HomeScreenProps) {
  return (
    <section className="max-w-2xl mx-auto">
      <HomeHero onOpenMethodology={onOpenMethodology} onOpenAbout={onOpenAbout} />

      {errors.length > 0 && <ConfigErrors errors={errors} />}

      <ProgressTeaser roles={activeRoles} onOpenProfile={onOpenProfile} />

      <h2 className="mb-3">Vyber si roli</h2>
      {activeRoles.length === 0 && (
        <p className="text-ink-muted mb-8">
          Zatím není dostupná žádná role. Autor stránky ji musí zapnout v konfiguraci.
        </p>
      )}
      <ul className="space-y-3 mb-10">
        {activeRoles.map((role, index) => (
          <li key={role.id}>
            <button
              type="button"
              onClick={() => onSelectRole(role.id)}
              className="soft-card w-full text-left p-5 flex items-start gap-4 transition-transform hover:-translate-y-0.5"
            >
              <RoleBadge title={role.title} sweepPosition={sweepPositionFor(index, activeRoles.length)} />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-lg">{role.title}</span>
                <span className="block text-ink-muted">{role.context}</span>
                <span className="mt-3 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-paper px-3 py-1 text-sm text-ink-muted">
                    <ClockIcon />
                    Asi {role.timeLimitMinutes} minut
                  </span>
                  <StatusChip status={roleStatus(taskProgress(loadSession(role.id)))} />
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      {upcomingRoleTitles.length > 0 && (
        <>
          <h2 className="text-sm font-semibold text-ink-muted mb-2">Připravujeme</h2>
          <ul className="flex flex-wrap gap-2">
            {upcomingRoleTitles.map((title) => (
              <li key={title} className="bg-surface rounded-full px-3 py-1 text-sm text-ink-muted">
                {title}
              </li>
            ))}
          </ul>
        </>
      )}

    </section>
  );
}

// Opening banner in the AI colour sweep (docs/SPEC.md, section 9). The heading and
// intro sit on the dark part; the coloured shapes are pinned to the bottom edge at a
// fixed aspect ratio, so on any width they stay under the text, never behind it.
// Inline SVG, so nothing is downloaded.
function HomeHero({ onOpenMethodology, onOpenAbout }: { onOpenMethodology: () => void; onOpenAbout?: () => void }) {
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

// Tells the person that unfinished work is waiting, so leaving a task never feels like losing it.
function StatusChip({ status }: { status: RoleStatus }) {
  if (status === "new") return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_srgb,var(--color-accent)_12%,transparent)] px-3 py-1 text-sm font-semibold text-accent">
      <span aria-hidden="true" className="size-1.5 rounded-full bg-accent" />
      {status === "inProgress" ? "Rozpracováno" : "Odevzdáno"}
    </span>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="8" r="6.25" />
      <path d="M8 4.75V8l2.25 1.5" strokeLinecap="round" />
    </svg>
  );
}

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
