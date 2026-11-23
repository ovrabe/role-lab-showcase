import type { RoleConfig } from "../roles/roleSchema";
import type { RoleLoadError } from "../roles/loadRoles";
import { roleGroups } from "../roles/roleGroups";
import { ProgressTeaser } from "../progress/ProgressTeaser";
import { DailyChallengeCard } from "../challenges/DailyChallengeCard";
import { CustomTaskCard } from "../customTask/CustomTaskCard";
import type { ChallengeConfig } from "../challenges/challengeSchema";
import { useState } from "react";
import { MessageSquare } from "lucide-react";
import { FeedbackDialog } from "../components/FeedbackDialog";
import { isWebBuild } from "../buildFlags";
import { RoleList } from "../home/RoleList";

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
  // Web version only (docs/SPEC.md, section 14).
  onOpenCustomTask?: () => void;
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
  onOpenCustomTask,
}: HomeScreenProps) {
  const roleCards = roleGroups(activeRoles);
  const [isSuggestionOpen, setIsSuggestionOpen] = useState(false);
  return (
    <section className="mx-auto max-w-4xl">
      <HomeHero onOpenTour={onOpenTour} onOpenMethodology={onOpenMethodology} onOpenAbout={onOpenAbout} />

      {errors.length > 0 && <ConfigErrors errors={errors} />}

      <ProgressTeaser roles={activeRoles} onOpenProfile={onOpenProfile} />

      <DailyChallengeCard
        challenge={dailyChallenge}
        totalCount={challenges.length}
        onStart={onSelectChallenge}
        onOpenMap={onOpenChallengeMap}
      />

      {/* The note sits under the heading on every screen; the extra space below keeps it apart from the cards. */}
      <div className="mb-5 space-y-1">
        <h2>Vyber si roli</h2>
        {/* Role Lab is for practice for now (decided 17. 11. 2026): said once, where people choose. */}
        <p className="text-sm text-ink-muted">Je to trénink, ne zkouška. Výsledek vidíš jen ty.</p>
      </div>
      {activeRoles.length === 0 && (
        <p className="text-ink-muted mb-8">
          Zatím není dostupná žádná role. Autor stránky ji musí zapnout v konfiguraci.
        </p>
      )}
      <RoleList groups={roleCards} onSelectRole={onSelectRole} />

      {/* Web: opens the custom task here. claude.ai pages: a link to the web version. */}
      <CustomTaskCard onOpen={onOpenCustomTask} />

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

// Opening banner in the AI colour sweep (docs/SPEC.md, section 9), kept low so the roles
// start on the first screen. On a computer the shapes sit beside the text, drawn whole ("meet"),
// because cropping them cuts the waves off where they rise on the left; on a phone a
// low strip of waves drawn for that height runs along the bottom, so nothing is cut off.
// Inline SVG, so nothing is downloaded.
function HomeHero({ onOpenTour, onOpenMethodology, onOpenAbout }: { onOpenTour: () => void; onOpenMethodology: () => void; onOpenAbout?: () => void }) {
  return (
    <div className="relative overflow-hidden rounded-card mb-6 bg-linear-to-br from-[#241d5c] via-[#3a2a8a] to-[#5a37b8]">
      <svg viewBox="0 0 640 80" preserveAspectRatio="none" aria-hidden="true" className="sm:hidden absolute bottom-0 left-0 w-full h-10">
        <defs>
          <linearGradient id="home-hero-strip" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="#ff7a45" />
            <stop offset="0.45" stopColor="#e5489b" />
            <stop offset="1" stopColor="#8a5cf6" />
          </linearGradient>
        </defs>
        <path d="M0 80 C160 78 260 56 400 52 S580 34 640 10 L640 80 Z" fill="url(#home-hero-strip)" />
        <path d="M0 80 C200 79 330 70 470 70 S600 66 640 58 L640 80 Z" fill="#ff7a45" opacity="0.55" />
      </svg>
      <svg
        viewBox="0 0 640 360"
        preserveAspectRatio="xMaxYMax meet"
        aria-hidden="true"
        className="hidden sm:block absolute bottom-0 right-0 h-full w-1/2 opacity-90"
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
      <div className="relative text-white px-6 pt-6 pb-12 sm:px-8 sm:py-10 sm:max-w-2xl">
        <h1 className="mb-3 sm:mb-4 sm:text-[34px]">Práce s AI na úkolu z praxe</h1>
        <p className="text-white/85 leading-relaxed text-balance sm:text-lg">Vyřeš úkol z praxe s AI asistentem a uvidíš hodnocení výsledku i postupu.</p>
        <div className="mt-5 sm:mt-8 flex flex-wrap gap-2">
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
