import type { ChallengeConfig } from "./challengeSchema";

/** The calendar day in Prague as "2026-11-15", the same day boundary as the server's limits. */
export function pragueDay(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Prague" }).format(date);
}

/**
 * The challenge of the day: the same for everyone on the same day, no server needed.
 * Days are counted from a fixed start and walk the map with a step of 7. With 15 challenges
 * (or any count that 7 does not divide) every challenge comes once in each round, and two
 * days in a row are almost never the same skill, because the map is sorted by skill.
 */
export function dailyChallenge(challenges: ChallengeConfig[], day: string): ChallengeConfig | null {
  if (challenges.length === 0) return null;
  const dayNumber = Math.round(Date.parse(`${day}T00:00:00Z`) / 86_400_000);
  const step = challenges.length % 7 === 0 ? 1 : 7;
  const index = (((dayNumber * step) % challenges.length) + challenges.length) % challenges.length;
  return challenges[index];
}
