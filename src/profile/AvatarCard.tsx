import { useState } from "react";
import { Lock } from "lucide-react";
import { avatarColors, isUnlocked, saveAvatar, stations, unlockHint, type Avatar } from "./avatar";
import { AvatarMedal, Emblem, useAvatar } from "./AvatarMedal";

type AvatarCardProps = { earnedBadgeIds: Set<string>; badgeCount: number; badgeTotal: number; attemptCount: number; dayCount: number };

/**
 * The top of "Můj profil": the avatar, the nickname, a short summary and the editor. The
 * ship theme behind the icons stays a quiet easter egg: their names appear only on hover,
 * nowhere in the text, so the profile stays about practising work with AI.
 */
export function AvatarCard({ earnedBadgeIds, badgeCount, badgeTotal, attemptCount, dayCount }: AvatarCardProps) {
  const avatar = useAvatar();
  const [isEditing, setIsEditing] = useState(false);
  const [lockedHint, setLockedHint] = useState("");
  const update = (change: Partial<Avatar>) => saveAvatar({ ...avatar, ...change });
  const name = avatar.nickname.trim();

  return (
    <section aria-label="Avatar" className="card space-y-5">
      <div className="flex items-center gap-4">
        <AvatarMedal avatar={avatar} />
        <div className="min-w-0 flex-1">
          {/* No greeting with the nickname: Czech would need the vocative, which cannot be built reliably. */}
          {name && <p className="text-xl font-semibold">{name}</p>}
          <p className="text-sm text-ink-muted mb-3">
            Odznaky {badgeCount} z {badgeTotal} · Pokusy {attemptCount} · Dny s tréninkem {dayCount}
          </p>
          <button
            type="button"
            onClick={() => setIsEditing((current) => !current)}
            aria-expanded={isEditing}
            className="rounded-full border border-line px-4 py-1.5 text-sm"
          >
            {isEditing ? "Hotovo" : "Změnit ikonu"}
          </button>
        </div>
      </div>

      {isEditing && (
        <div className="space-y-5 border-t border-line pt-5">
          <fieldset>
            <legend className="font-semibold mb-3">Ikona</legend>
            <div className="flex flex-wrap gap-2">
              {stations.map((station) => {
                const unlocked = isUnlocked(station.unlock, earnedBadgeIds);
                const label = unlocked || !station.secret ? station.name : "Tajná ikona";
                return (
                  <button
                    key={station.id}
                    type="button"
                    aria-pressed={avatar.station === station.id}
                    aria-label={unlocked ? label : `${label} (zamčeno)`}
                    title={unlocked ? label : `${label}: ${unlockHint(station.unlock)}`}
                    onClick={() => (unlocked ? update({ station: station.id }) : setLockedHint(unlockHint(station.unlock)))}
                    className={`relative grid place-items-center size-12 rounded-full border border-line ${
                      unlocked ? "text-ink hover:bg-paper" : "text-ink-muted opacity-50"
                    } aria-pressed:border-2 aria-pressed:border-[var(--color-progress)] aria-pressed:text-progress`}
                  >
                    {unlocked || !station.secret ? <Emblem id={station.id} size={26} /> : <span aria-hidden="true">?</span>}
                    {!unlocked && (
                      <Lock aria-hidden="true" size={12} className="absolute -bottom-0.5 -right-0.5 rounded-full bg-surface p-0.5 box-content" />
                    )}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset>
            <legend className="font-semibold mb-3">Barva</legend>
            <div className="flex flex-wrap gap-3">
              {avatarColors.map((color) => {
                const unlocked = isUnlocked(color.unlock, earnedBadgeIds);
                return (
                  <button
                    key={color.id}
                    type="button"
                    aria-pressed={avatar.color === color.id}
                    aria-label={unlocked ? color.name : `${color.name} (zamčeno)`}
                    title={unlocked ? color.name : `${color.name}: ${unlockHint(color.unlock)}`}
                    onClick={() => (unlocked ? update({ color: color.id }) : setLockedHint(`${color.name}: ${unlockHint(color.unlock)}`))}
                    className={`relative size-9 rounded-full ring-offset-2 ring-offset-[var(--color-surface)] aria-pressed:ring-2 aria-pressed:ring-[var(--color-ink)] ${
                      unlocked ? "" : "opacity-40"
                    }`}
                    style={{ backgroundImage: color.gradient }}
                  >
                    {!unlocked && <Lock aria-hidden="true" size={14} className="absolute inset-0 m-auto text-white" />}
                  </button>
                );
              })}
            </div>
          </fieldset>

          {lockedHint && (
            <p role="status" className="bg-notice text-notice-ink rounded-control p-3 text-sm">
              {lockedHint}
            </p>
          )}

          <label className="block">
            <span className="block font-semibold mb-1">Přezdívka (nepovinné)</span>
            <input
              value={avatar.nickname}
              onChange={(event) => update({ nickname: event.target.value })}
              maxLength={24}
              placeholder="Jak ti říkat"
              className="w-full max-w-xs rounded-control border border-line bg-surface p-3 text-base"
            />
            <span className="block text-sm text-ink-muted mt-1">Ukládá se jen v tomhle prohlížeči.</span>
          </label>
        </div>
      )}
    </section>
  );
}
