import { z } from "zod";
import { readItem, writeItem } from "../session/sessionStorage";

/**
 * The avatar in "Můj profil": an emblem and a colour, some unlocked by badges, which gives
 * badges a use. A few emblems are the author's quiet easter egg, so names show only on hover.
 */
export type Unlock = { kind: "free" } | { kind: "badge"; badgeId: string; hint: string } | { kind: "badgeCount"; count: number };

export type Station = { id: string; name: string; unlock: Unlock; secret?: boolean };
export type AvatarColor = { id: string; name: string; gradient: string; unlock: Unlock };

const free: Unlock = { kind: "free" };

export const stations: Station[] = [
  { id: "dolphin", name: "Delfín", unlock: free },
  { id: "falcon", name: "Sokol", unlock: free },
  { id: "cat", name: "Schrödingerova kočka", unlock: free },
  {
    id: "octopus",
    name: "Chobotnice",
    secret: true,
    unlock: { kind: "badge", badgeId: "big-leap", hint: "Odemkne se velkým skokem v jedné dovednosti." },
  },
  { id: "monstera", name: "Monstera", unlock: free },
  { id: "paper-clip", name: "Svorka", unlock: free },
  // Mastery icons: each unlocked by mastering one of the skills Role Lab evaluates.
  { id: "anchor", name: "Kotva", unlock: { kind: "badge", badgeId: "master-verification", hint: "Odemkne se odznakem Mistr ověřování." } },
  { id: "pointy-hat", name: "Čarodějný klobouk", unlock: { kind: "badge", badgeId: "master-framing", hint: "Odemkne se odznakem Mistr zadání." } },
  { id: "chess-knight", name: "Šachový kůň", unlock: { kind: "badge", badgeId: "master-judgment", hint: "Odemkne se odznakem Mistr úsudku." } },
  { id: "over-infinity", name: "Nekonečno", unlock: { kind: "badge", badgeId: "master-iteration", hint: "Odemkne se odznakem Mistr iterace." } },
  { id: "yin-yang", name: "Jin a jang", unlock: { kind: "badge", badgeId: "all-round", hint: "Odemkne se odznakem Všestrannost." } },
  {
    id: "viking-helmet",
    name: "Vikinská helma",
    unlock: { kind: "badge", badgeId: "on-recommendation", hint: "Odemkne se odznakem Na doporučení." },
  },
  { id: "drakkar", name: "Vikinská loď", unlock: free },
  { id: "ufo", name: "UFO", unlock: free },
  { id: "astronaut-helmet", name: "Astronautská helma", unlock: free },
  // Ancient Egypt and a ring between the stars: a quiet nod to a favourite sci-fi series,
  // using only shared mythology and a generic gate, nothing from the series itself.
  { id: "cobra", name: "Kobra", unlock: { kind: "badge", badgeId: "detective-both-roles", hint: "Odemkne se odznakem Detektiv v obou rolích." } },
  { id: "eye-of-horus", name: "Oko Hora", unlock: { kind: "badge", badgeId: "seven-days", hint: "Odemkne se odznakem Sedm různých dnů." } },
  { id: "gate", name: "Brána", unlock: { kind: "badgeCount", count: 20 } },
];

export const avatarColors: AvatarColor[] = [
  { id: "deep-space", name: "Hluboký vesmír", gradient: "linear-gradient(135deg, #8a5cf6, #5b6cff)", unlock: free },
  { id: "nebula", name: "Mlhovina", gradient: "linear-gradient(135deg, #ff7a45, #e5489b)", unlock: free },
  { id: "aurora", name: "Polární záře", gradient: "linear-gradient(135deg, #1d9e75, #22c1c3)", unlock: free },
  { id: "ocean", name: "Oceán", gradient: "linear-gradient(135deg, #1d4a9e, #3d7bff)", unlock: free },
  { id: "solar-wind", name: "Sluneční vítr", gradient: "linear-gradient(135deg, #f59e0b, #ef4444)", unlock: free },
  { id: "gold-dust", name: "Zlatý prach", gradient: "linear-gradient(135deg, #d9a521, #8a5a00)", unlock: { kind: "badgeCount", count: 10 } },
];

export function isUnlocked(unlock: Unlock, earnedBadgeIds: Set<string>): boolean {
  if (unlock.kind === "free") return true;
  if (unlock.kind === "badge") return earnedBadgeIds.has(unlock.badgeId);
  return earnedBadgeIds.size >= unlock.count;
}

export function unlockHint(unlock: Unlock): string {
  if (unlock.kind === "free") return "";
  if (unlock.kind === "badge") return unlock.hint;
  return unlock.count >= 20 ? "Odemkne se, až získáš všech 20 odznaků." : `Odemkne se od ${unlock.count} odznaků.`;
}

export const Avatar = z.object({
  station: z.string(),
  color: z.string(),
  nickname: z.string().max(24),
});
export type Avatar = z.infer<typeof Avatar>;

export const defaultAvatar: Avatar = { station: "dolphin", color: "deep-space", nickname: "" };

const avatarKey = "role-lab:avatar";
// The header shows the avatar too; it listens for this event to follow changes in the profile.
export const avatarChangedEvent = "role-lab:avatar-changed";

/** The saved avatar. Unknown or locked choices fall back, so a broken value never shows. */
export function loadAvatar(earnedBadgeIds: Set<string>): Avatar {
  let saved: Avatar = defaultAvatar;
  try {
    const parsed = Avatar.safeParse(JSON.parse(readItem(avatarKey) ?? "null"));
    if (parsed.success) saved = parsed.data;
  } catch {
    // Unreadable value: keep the default.
  }
  const station = stations.find((item) => item.id === saved.station);
  const color = avatarColors.find((item) => item.id === saved.color);
  return {
    station: station && isUnlocked(station.unlock, earnedBadgeIds) ? station.id : defaultAvatar.station,
    color: color && isUnlocked(color.unlock, earnedBadgeIds) ? color.id : defaultAvatar.color,
    nickname: saved.nickname,
  };
}

export function saveAvatar(avatar: Avatar): void {
  writeItem(avatarKey, JSON.stringify({ ...avatar, nickname: avatar.nickname.slice(0, 24) }));
  window.dispatchEvent(new Event(avatarChangedEvent));
}
