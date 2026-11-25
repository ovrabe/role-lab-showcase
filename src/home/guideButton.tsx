import { useEffect, useSyncExternalStore } from "react";
import { CircleHelp } from "lucide-react";

/**
 * The "?" in the header (src/App.tsx) opens the guide of the screen you are on: the home page
 * or an unfinished task. The screen registers how to open its guide; without one, the "?" hides.
 * The header sits outside the screens, so they meet here instead of through props.
 */
let openCurrentGuide: (() => void) | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function setOpener(open: (() => void) | null) {
  openCurrentGuide = open;
  listeners.forEach((listener) => listener());
}

/** For a screen with a guide; pass null while it has none (a submitted task). */
export function useGuideOpener(open: (() => void) | null) {
  useEffect(() => {
    setOpener(open);
    return () => setOpener(null);
  }, [open]);
}

export function GuideButton() {
  const hasGuide = useSyncExternalStore(subscribe, () => openCurrentGuide !== null);
  if (!hasGuide) return null;
  return (
    <button
      type="button"
      onClick={() => openCurrentGuide?.()}
      aria-label="Nápověda: jak na to"
      title="Nápověda"
      className="grid place-items-center size-10 rounded-full text-ink-muted hover:text-ink hover:bg-surface"
    >
      <CircleHelp aria-hidden="true" size={18} strokeWidth={2} />
    </button>
  );
}
