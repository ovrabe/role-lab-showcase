import { ChevronRight } from "lucide-react";
import type { RoleConfig } from "../roles/roleSchema";
import { allBadges, earnedBadges } from "./badges";
import { recommendedSkill, skillLevels } from "./progress";
import { loadProgress } from "./progressStorage";

type ProgressTeaserProps = { roles: RoleConfig[]; onOpenProfile: () => void };

/**
 * One quiet line on the home page after the first evaluation: what to practise and a way into
 * "Můj profil". The home page stays about choosing a task; the details live in the profile.
 */
export function ProgressTeaser({ roles, onOpenProfile }: ProgressTeaserProps) {
  const { attempts } = loadProgress();
  if (attempts.length === 0 || roles.length === 0) return null;

  const focus = recommendedSkill(skillLevels(attempts));
  const focusName = roles[0].rubric.find((dimension) => dimension.id === focus)?.name;
  const badgeCount = earnedBadges(attempts).length;

  return (
    <button
      type="button"
      onClick={onOpenProfile}
      className="soft-card w-full mb-8 px-5 py-3 flex items-center gap-3 text-left transition-transform hover:-translate-y-0.5"
    >
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">Můj profil</span>
        <span className="block text-sm text-ink-muted">
          {focusName ? `Doporučeno trénovat: ${focusName}` : "Tvůj pokrok"} · Odznaky {badgeCount} z {allBadges.length}
        </span>
      </span>
      <ChevronRight aria-hidden="true" size={20} className="text-ink-muted" />
    </button>
  );
}
