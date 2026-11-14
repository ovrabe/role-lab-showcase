import { useEffect, useState } from "react";
import { emblemPaths } from "./emblems";
import { avatarChangedEvent, avatarColors, loadAvatar, type Avatar } from "./avatar";
import { earnedBadges } from "../progress/badges";
import { loadProgress } from "../progress/progressStorage";

/** An emblem as a filled silhouette in the current text colour. */
export function Emblem({ id, size }: { id: string; size: number }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 512 512" width={size} height={size} fill="currentColor">
      <path d={emblemPaths[id] ?? emblemPaths.dolphin} />
    </svg>
  );
}

export const earnedBadgeIds = () => new Set(earnedBadges(loadProgress().attempts).map((badge) => badge.id));

/** The saved avatar, kept current when it changes in the profile (the header uses it too). */
export function useAvatar(): Avatar {
  const [avatar, setAvatar] = useState(() => loadAvatar(earnedBadgeIds()));
  useEffect(() => {
    const update = () => setAvatar(loadAvatar(earnedBadgeIds()));
    window.addEventListener(avatarChangedEvent, update);
    return () => window.removeEventListener(avatarChangedEvent, update);
  }, []);
  return avatar;
}

/** The avatar as a round medal: the emblem on the chosen colour. The gate gets a golden halo. */
export function AvatarMedal({ avatar, size = 72 }: { avatar: Avatar; size?: number }) {
  const gradient = avatarColors.find((color) => color.id === avatar.color)?.gradient ?? avatarColors[0].gradient;
  const isGate = avatar.station === "gate";
  return (
    <span
      aria-hidden="true"
      className={`shrink-0 grid place-items-center rounded-full text-white ${isGate ? "ring-2 ring-offset-2 ring-offset-[var(--color-surface)] ring-[#f7d774]" : ""}`}
      style={{ width: size, height: size, backgroundImage: gradient }}
    >
      <Emblem id={avatar.station} size={Math.round(size * 0.62)} />
    </span>
  );
}
