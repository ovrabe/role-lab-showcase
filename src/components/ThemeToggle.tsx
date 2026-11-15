import { useEffect, useRef, useState } from "react";
import { Check, Moon, Sun, SunMoon, type LucideIcon } from "lucide-react";

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

// One round icon showing the current theme; a click opens a small menu with the three
// choices. Lighter than three icons side by side, and the names are always visible in the menu.
export function ThemeToggle() {
  const [choice, setChoice] = useState<ThemeChoice>(loadThemeChoice);
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close on a click outside or on Escape, as menus usually do.
  useEffect(() => {
    if (!isOpen) return;
    function onPointerDown(event: PointerEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) setIsOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setIsOpen(false);
      buttonRef.current?.focus();
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  function select(next: ThemeChoice) {
    setChoice(next);
    applyThemeChoice(next);
    saveThemeChoice(next);
    setIsOpen(false);
    buttonRef.current?.focus();
  }

  const current = themeOptions.find((option) => option.value === choice) ?? themeOptions[0];
  const CurrentIcon = current.icon;

  return (
    <div ref={wrapperRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={`Vzhled: ${current.label}`}
        title="Vzhled"
        className="grid place-items-center size-10 rounded-full text-ink-muted hover:text-ink hover:bg-surface aria-expanded:bg-surface aria-expanded:text-ink"
      >
        <CurrentIcon aria-hidden="true" size={18} strokeWidth={2} />
      </button>
      {isOpen && (
        <div
          role="menu"
          aria-label="Vzhled"
          className="rl-rise absolute top-full right-0 mt-2 z-40 min-w-44 rounded-card border border-line bg-surface p-1 shadow-[var(--shadow-floating)]"
        >
          {themeOptions.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              role="menuitemradio"
              aria-checked={choice === value}
              onClick={() => select(value)}
              // The chosen item gets focus, so arrow-free keyboard use still works with Tab.
              autoFocus={choice === value}
              className="w-full flex items-center gap-3 rounded-chip px-3 py-2 text-sm text-left text-ink hover:bg-paper focus-visible:bg-paper aria-checked:font-semibold"
            >
              <Icon aria-hidden="true" size={16} strokeWidth={2} />
              <span className="flex-1 whitespace-nowrap">{label}</span>
              {choice === value && <Check aria-hidden="true" size={16} strokeWidth={2.5} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
