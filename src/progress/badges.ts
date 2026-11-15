import { dimensionIds, type DimensionId } from "../roles/roleSchema";
import { skillNames } from "../roles/skillNames";
import { roleOfTask } from "../roles/taskRoles";
import { recommendedSkill, skillLevels, type ProgressAttempt } from "./progress";

/**
 * Badges for real behaviour, read from the evaluations (docs/PRODUCTION.md, part 10).
 * Nothing extra is stored: every badge is derived from the history. Once earned, a badge
 * stays, even if a later attempt is weaker, because a rule counts when it held at any point.
 */
export type BadgeGroup = "start" | "rhythm" | "data" | "mastery" | "growth" | "overall";
export type Badge = { id: string; title: string; description: string; group: BadgeGroup };

export const badgeGroups: { id: BadgeGroup; title: string }[] = [
  { id: "start", title: "Začátky" },
  { id: "rhythm", title: "Pravidelnost" },
  { id: "data", title: "Data" },
  { id: "mastery", title: "Mistrovství" },
  { id: "growth", title: "Posun" },
  { id: "overall", title: "Celkově" },
];

// Checked against the history up to one attempt: `upTo` ends with the attempt in question.
type BadgeRule = Badge & { heldAfter: (upTo: ProgressAttempt[]) => boolean };

const latestOf = (upTo: ProgressAttempt[]) => upTo[upTo.length - 1];
const levelsBefore = (upTo: ProgressAttempt[]) => skillLevels(upTo.slice(0, -1));
const allTrapsCaught = (attempt: ProgressAttempt) => attempt.traps.total > 0 && attempt.traps.caught === attempt.traps.total;

// Days as people in Czechia count them.
const dayOf = (attempt: ProgressAttempt) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Prague" }).format(new Date(attempt.evaluatedAt));

const masteryTitles: Record<DimensionId, string> = {
  framing: "Mistr zadání",
  decomposition: "Mistr rozkladu",
  verification: "Mistr ověřování",
  iteration: "Mistr iterace",
  judgment: "Mistr úsudku",
};

const rules: BadgeRule[] = [
  { id: "first-attempt", group: "start", title: "První pokus", description: "První dokončené hodnocení.", heldAfter: (upTo) => upTo.length >= 1 },
  { id: "five-attempts", group: "start", title: "5 pokusů", description: "Pět dokončených hodnocení.", heldAfter: (upTo) => upTo.length >= 5 },
  { id: "ten-attempts", group: "start", title: "10 pokusů", description: "Deset dokončených hodnocení.", heldAfter: (upTo) => upTo.length >= 10 },

  {
    id: "three-days",
    group: "rhythm",
    title: "Tři různé dny",
    description: "Hodnocení ve třech různých dnech.",
    heldAfter: (upTo) => new Set(upTo.map(dayOf)).size >= 3,
  },
  {
    id: "seven-days",
    group: "rhythm",
    title: "Sedm různých dnů",
    description: "Hodnocení v sedmi různých dnech.",
    heldAfter: (upTo) => new Set(upTo.map(dayOf)).size >= 7,
  },

  {
    id: "data-detective",
    group: "data",
    title: "Detektiv dat",
    description: "V jednom pokusu odhaleny všechny záludnosti v datech.",
    heldAfter: (upTo) => allTrapsCaught(latestOf(upTo)),
  },
  {
    id: "detective-both-roles",
    group: "data",
    title: "Detektiv v obou rolích",
    description: "Všechny záludnosti odhaleny v obou rolích.",
    heldAfter: (upTo) => new Set(upTo.filter(allTrapsCaught).map((attempt) => roleOfTask(attempt.roleId))).size >= 2,
  },

  ...dimensionIds.map(
    (dimension): BadgeRule => ({
      id: `master-${dimension}`,
      group: "mastery",
      title: masteryTitles[dimension],
      description: `${skillNames[dimension]} na úrovni 4.`,
      heldAfter: (upTo) => latestOf(upTo).scores[dimension] === 4,
    }),
  ),

  {
    id: "step-up",
    group: "growth",
    title: "Posun vpřed",
    description: "Zlepšení v některé dovednosti o úroveň.",
    heldAfter: (upTo) => {
      const before = levelsBefore(upTo);
      return dimensionIds.some((dimension) => (latestOf(upTo).scores[dimension] ?? 0) > (before[dimension] ?? Infinity));
    },
  },
  {
    id: "big-leap",
    group: "growth",
    title: "Velký skok",
    description: "Zlepšení v jedné dovednosti o dvě úrovně najednou.",
    heldAfter: (upTo) => {
      const before = levelsBefore(upTo);
      return dimensionIds.some((dimension) => (latestOf(upTo).scores[dimension] ?? 0) - (before[dimension] ?? Infinity) >= 2);
    },
  },
  {
    id: "on-recommendation",
    group: "growth",
    title: "Na doporučení",
    description: "Zlepšení právě v dovednosti, kterou Role Lab doporučil trénovat.",
    heldAfter: (upTo) => {
      const before = levelsBefore(upTo);
      const focus = recommendedSkill(before);
      return focus !== null && (latestOf(upTo).scores[focus] ?? 0) > (before[focus] ?? Infinity);
    },
  },

  {
    id: "both-roles",
    group: "overall",
    title: "Obě role",
    description: "Hodnocení v obou rolích.",
    heldAfter: (upTo) => new Set(upTo.map((attempt) => roleOfTask(attempt.roleId))).size >= 2,
  },
  {
    id: "no-weak-spot",
    group: "overall",
    title: "Bez slabin",
    description: "Všech pět dovedností aspoň na úrovni 2.",
    heldAfter: (upTo) => dimensionIds.every((dimension) => (skillLevels(upTo)[dimension] ?? 0) >= 2),
  },
  {
    id: "all-round",
    group: "overall",
    title: "Všestrannost",
    description: "Všech pět dovedností aspoň na úrovni 3.",
    heldAfter: (upTo) => dimensionIds.every((dimension) => (skillLevels(upTo)[dimension] ?? 0) >= 3),
  },
  {
    id: "level-three",
    group: "overall",
    title: "Celková úroveň 3",
    description: "Celková úroveň 3 v některém pokusu.",
    heldAfter: (upTo) => latestOf(upTo).level >= 3,
  },
  {
    id: "level-four",
    group: "overall",
    title: "Celková úroveň 4",
    description: "Celková úroveň 4 v některém pokusu.",
    heldAfter: (upTo) => latestOf(upTo).level >= 4,
  },
];

/** On how many different days the person trained (Czech time). */
export const trainingDays = (attempts: ProgressAttempt[]) => new Set(attempts.map(dayOf)).size;

const toBadge = ({ id, title, description, group }: BadgeRule): Badge => ({ id, title, description, group });

export function earnedBadges(attempts: ProgressAttempt[]): Badge[] {
  return rules
    .filter((rule) => attempts.some((_attempt, index) => rule.heldAfter(attempts.slice(0, index + 1))))
    .map(toBadge);
}

/** Badges one attempt added, for its result screen. */
export function badgesAt(attempts: ProgressAttempt[], index: number): Badge[] {
  if (index < 0 || index >= attempts.length) return [];
  const before = new Set(earnedBadges(attempts.slice(0, index)).map((badge) => badge.id));
  return earnedBadges(attempts.slice(0, index + 1)).filter((badge) => !before.has(badge.id));
}

export const allBadges: Badge[] = rules.map(toBadge);
