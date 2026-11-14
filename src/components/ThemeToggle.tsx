import { useEffect, useState } from "react";
import { Moon, Sun, SunMoon, type LucideIcon } from "lucide-react";

// "system" follows the operating system (prefers-color-scheme); the other two
// force a theme through data-theme on <html>, which the color tokens in index.css read.
export type ThemeChoice = "system" | "light" | "dark";

const storageKey = "role-lab:theme";

export function loadThemeChoice(): ThemeChoice {
  try {
    const stored = window.localStorage.getItem(storageKey);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
}

export function applyThemeChoice(choice: ThemeChoice) {
  if (choice === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = choice;
}

function saveThemeChoice(choice: ThemeChoice) {
  try {
    if (choice === "system") window.localStorage.removeItem(storageKey);
    else window.localStorage.setItem(storageKey, choice);
  } catch {
    // Storage refused: the choice still applies until the page is closed.
  }
}

const themeOptions: { value: ThemeChoice; label: string; icon: LucideIcon }[] = [
  { value: "system", label: "Podle systému", icon: SunMoon },
  { value: "light", label: "Světlý", icon: Sun },
  { value: "dark", label: "Tmavý", icon: Moon },
];

// Three small icons in a pill, so the switch fits beside the title on a phone. The name of
// a theme shows only for a moment right after it is chosen (and on hover with a mouse);
// otherwise the chosen icon alone is enough. Real radio buttons underneath, so arrow keys
// and screen readers work without extra code.
export function ThemeToggle() {
  const [choice, setChoice] = useState<ThemeChoice>(loadThemeChoice);
  const [flashedLabel, setFlashedLabel] = useState<string | null>(null);

  useEffect(() => {
    if (flashedLabel === null) return;
    const timeout = window.setTimeout(() => setFlashedLabel(null), 1600);
    return () => window.clearTimeout(timeout);
  }, [flashedLabel]);

  function select(next: ThemeChoice) {
    setChoice(next);
    applyThemeChoice(next);
    saveThemeChoice(next);
    setFlashedLabel(themeOptions.find((option) => option.value === next)?.label ?? null);
  }

  return (
    <div className="relative">
      <fieldset className="flex items-center rounded-full bg-paper p-0.5">
        <legend className="sr-only">Vzhled</legend>
        {themeOptions.map(({ value, label, icon: Icon }) => (
          <label
            key={value}
            className="group relative grid place-items-center size-8 rounded-full text-ink-muted cursor-pointer hover:text-ink has-checked:bg-surface has-checked:text-ink has-checked:shadow-[var(--shadow-card)] has-focus-visible:outline-2 has-focus-visible:outline-accent"
          >
            <input
              type="radio"
              name="theme"
              value={value}
              checked={choice === value}
              onChange={() => select(value)}
              className="sr-only"
            />
            <Icon aria-hidden="true" size={16} strokeWidth={2} />
            <span className="sr-only">{label}</span>
            {/* Mouse hover only (Tailwind applies hover only on devices that have it); on a
                phone the name shows after a tap instead. */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute top-full right-0 mt-2 z-40 whitespace-nowrap rounded-chip bg-action text-action-contrast px-2.5 py-1 text-xs opacity-0 transition-opacity duration-100 group-hover:opacity-100 group-has-checked:hidden"
            >
              {label}
            </span>
          </label>
        ))}
      </fieldset>
      {flashedLabel && (
        <p
          role="status"
          className="rl-rise absolute top-full right-0 mt-2 z-40 whitespace-nowrap rounded-full bg-action text-action-contrast px-3 py-1 text-xs font-semibold shadow-[var(--shadow-floating)]"
        >
          {flashedLabel}
        </p>
      )}
    </div>
  );
}
