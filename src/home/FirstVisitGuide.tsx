import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { readItem, writeItem } from "../session/sessionStorage";

/**
 * A few bubbles that point at what to click first, shown once on the first visit of a screen.
 * Each step names an element by its data-guide attribute; the page around it is dimmed and a
 * short text sits next to it. Not a modal: the page stays usable, Esc or "Přeskočit" ends it.
 */
export type GuideStep = { target: string; title: string; text: string };

const gutter = 16;
const bubbleWidth = 340;

// Where the bubble sits next to the element; the arrow on the bubble points back at it.
type Side = "below" | "above" | "left" | "right" | "over";
type Placement = { spot: DOMRect; top: number; left: number; side: Side };
// The page settles first (fonts, layout), then the guide fades in.
const startDelayMs = 450;

function measure(target: string, bubbleHeight: number): Placement | null {
  const element = document.querySelector(`[data-guide="${target}"]`);
  if (!element) return null;
  const spot = element.getBoundingClientRect();
  const width = Math.min(bubbleWidth, window.innerWidth - 2 * gutter);
  const left = Math.min(Math.max(spot.left, gutter), window.innerWidth - width - gutter);
  // Below the element when there is room, otherwise above it. A tall element (the assistant
  // panel on a computer) leaves room for neither: then beside it, left or right, at its top.
  const below = spot.bottom + 12;
  const above = spot.top - 12 - bubbleHeight;
  if (below + bubbleHeight < window.innerHeight) return { spot, top: below, left, side: "below" };
  if (above > 0) return { spot, top: above, left, side: "above" };
  const besideTop = Math.min(Math.max(spot.top, gutter), window.innerHeight - bubbleHeight - gutter);
  if (spot.left - width - 12 >= gutter) return { spot, top: besideTop, left: spot.left - width - 12, side: "left" };
  if (spot.right + 12 + width <= window.innerWidth - gutter) return { spot, top: besideTop, left: spot.right + 12, side: "right" };
  return { spot, top: window.innerHeight - bubbleHeight - gutter, left, side: "over" };
}

// The arrow's position on the bubble's edge, pointing at the middle of the element.
function arrowStyle({ spot, top, left, side }: Placement, width: number): CSSProperties | null {
  const clamp = (value: number, max: number) => Math.min(Math.max(value, 18), max - 18);
  const base: CSSProperties = { position: "absolute", width: 14, height: 14, transform: "rotate(45deg)", background: "inherit" };
  if (side === "below") return { ...base, top: -7, left: clamp(spot.left + spot.width / 2 - left - 7, width) };
  if (side === "above") return { ...base, bottom: -7, left: clamp(spot.left + spot.width / 2 - left - 7, width) };
  if (side === "left") return { ...base, right: -7, top: clamp(Math.max(spot.top, top) + 24 - top, 200) };
  if (side === "right") return { ...base, left: -7, top: clamp(Math.max(spot.top, top) + 24 - top, 200) };
  return null;
}

export function hasSeenGuide(storageKey: string): boolean {
  return readItem(storageKey) === "seen";
}

export function FirstVisitGuide({ steps, storageKey, onClose }: { steps: GuideStep[]; storageKey: string; onClose: () => void }) {
  // Steps whose element is on the page (the daily challenge can be missing). Looked up after
  // the page is drawn: during the first render the elements do not exist yet.
  const [visible, setVisible] = useState<GuideStep[]>([]);
  useLayoutEffect(() => {
    setVisible(steps.filter((step) => document.querySelector(`[data-guide="${step.target}"]`)));
  }, [steps]);
  const [index, setIndex] = useState(0);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setIsReady(true), startDelayMs);
    return () => window.clearTimeout(timer);
  }, []);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const step = visible[index];

  const close = useCallback(() => {
    writeItem(storageKey, "seen");
    onClose();
  }, [storageKey, onClose]);

  // Bring the element into view, then place the bubble; again on resize and scroll.
  useLayoutEffect(() => {
    if (!step) return;
    const element = document.querySelector(`[data-guide="${step.target}"]`);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    element?.scrollIntoView({ block: "center", behavior: reduceMotion ? "auto" : "smooth" });
    // The bubble's real height (it wraps differently on a phone); a guess before it is drawn.
    const update = () => setPlacement(measure(step.target, bubbleRef.current?.offsetHeight ?? 220));
    update();
    // A smooth scroll ends later than this effect: measure once more when it has settled.
    const settled = window.setTimeout(update, 400);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, { passive: true });
    return () => {
      window.clearTimeout(settled);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update);
    };
  }, [step]);

  // Focus follows the bubble, so a keyboard or screen reader user hears each step.
  // On each step, and when the steps are first found (the bubble does not exist before).
  useEffect(() => {
    bubbleRef.current?.focus();
  }, [step]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  if (!step || !isReady) return null;
  const isLast = index === visible.length - 1;
  const width = Math.min(bubbleWidth, window.innerWidth - 2 * gutter);
  const arrow = placement ? arrowStyle(placement, width) : null;

  return (
    <>
      {placement && (
        // The spotlight: a frame around the element whose huge shadow dims everything else.
        <div
          key={step.target}
          aria-hidden="true"
          className="rl-guide-spot fixed z-40 rounded-card pointer-events-none transition-all duration-200 motion-reduce:transition-none"
          style={{
            top: placement.spot.top - 6,
            left: placement.spot.left - 6,
            width: placement.spot.width + 12,
            height: placement.spot.height + 12,
            // A soft violet glow and a faint tint instead of a hard line (the author's choice: a
            // line looked like a frame, a strong glow looked heavy), then the dimmed page.
            background: "rgb(138 92 246 / 0.05)",
            boxShadow: "0 0 0 2px rgb(138 92 246 / 0.14), 0 0 18px 3px rgb(138 92 246 / 0.26), 0 0 0 9999px rgb(8 6 24 / 0.62)",
          }}
        />
      )}
      <div
        ref={bubbleRef}
        role="dialog"
        aria-labelledby="guide-title"
        aria-describedby="guide-text"
        tabIndex={-1}
        className="rl-guide-in fixed z-50 rounded-card bg-surface text-ink shadow-[var(--shadow-card)] p-5 space-y-3 outline-none"
        style={{ top: placement?.top ?? gutter, left: placement?.left ?? gutter, width }}
      >
        {arrow && <span aria-hidden="true" style={arrow} />}
        <p className="text-xs font-semibold text-ink-muted">
          {index + 1} / {visible.length}
        </p>
        <h2 id="guide-title" className="text-lg">
          {step.title}
        </h2>
        <p id="guide-text" className="text-sm leading-relaxed">
          {step.text}
        </p>
        <div className="flex items-center justify-between gap-2 pt-1">
          <button type="button" onClick={close} className="text-sm text-ink-muted underline-offset-4 hover:underline">
            Přeskočit
          </button>
          <button
            type="button"
            onClick={() => (isLast ? close() : setIndex(index + 1))}
            className="rounded-full bg-action text-action-contrast px-4 py-2 text-sm font-semibold"
          >
            {isLast ? "Rozumím" : "Další"}
          </button>
        </div>
      </div>
    </>
  );
}
