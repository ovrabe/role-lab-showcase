import {
  Award,
  CalendarCheck,
  CalendarDays,
  ChevronsUp,
  Crosshair,
  Dumbbell,
  Flag,
  Gem,
  ListTree,
  Medal,
  MessageSquareText,
  Microscope,
  RefreshCw,
  Repeat,
  Scale,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";

// One picture per badge, so each reads at a glance (badges.ts keeps the rules free of UI).
const icons: Record<string, LucideIcon> = {
  "first-attempt": Flag,
  "five-attempts": Repeat,
  "ten-attempts": Dumbbell,
  "three-days": CalendarDays,
  "seven-days": CalendarCheck,
  "data-detective": ScanSearch,
  "detective-both-roles": Microscope,
  "master-framing": MessageSquareText,
  "master-decomposition": ListTree,
  "master-verification": ShieldCheck,
  "master-iteration": RefreshCw,
  "master-judgment": Scale,
  "step-up": TrendingUp,
  "big-leap": ChevronsUp,
  "on-recommendation": Crosshair,
  "both-roles": Users,
  "no-weak-spot": Sparkles,
  "all-round": Gem,
  "level-three": Medal,
  "level-four": Trophy,
};

/** The badge's icon on the progress gradient, as a round medal. */
export function BadgeIcon({ id, size = 36 }: { id: string; size?: number }) {
  const Icon = icons[id] ?? Award;
  return (
    <span
      aria-hidden="true"
      className="shrink-0 grid place-items-center rounded-full bg-[image:var(--progress-sweep)] text-white"
      style={{ width: size, height: size }}
    >
      <Icon size={Math.round(size * 0.5)} strokeWidth={2} />
    </span>
  );
}
