import { useEffect, type CSSProperties, type KeyboardEvent } from "react";
import { Check, FileText, FolderOpen, MessageCircle, Send, type LucideIcon } from "lucide-react";
import type { StepState } from "./taskProgress";

export type TabId = "brief" | "materials" | "assistant" | "submit";

export const tabLabels: Record<TabId, string> = {
  brief: "Zadání",
  materials: "Podklady",
  assistant: "Asistent",
  submit: "Odevzdat",
};

// Shown only in the bottom bar on a phone; hidden by CSS on a wide screen.
const tabIcons: Record<TabId, LucideIcon> = {
  brief: FileText,
  materials: FolderOpen,
  assistant: MessageCircle,
  submit: Send,
};

export const tabId = (tab: TabId) => `tab-${tab}`;
export const panelId = (tab: TabId) => `panel-${tab}`;

type TabBarProps = {
  tabs: TabId[];
  activeTab: TabId;
  onSelect: (tab: TabId) => void;
  // "bottom" lets the design pilot turn the bar into a floating bar at the bottom of a phone screen.
  placement?: "top" | "bottom";
  // The phone bar also shows the task progress: a tick on done steps, a dot on the next one.
  stepStates?: Record<TabId, StepState>;
};

/**
 * Tabs as in the WAI-ARIA tabs pattern: arrow keys move between tabs and select them,
 * Home and End jump to the ends, and Tab leaves the tab list for the panel, because
 * only the selected tab is in the tab order.
 */
// The phone bar steps aside while the person scrolls down to read and comes back as soon
// as they scroll up, as in common phone apps. The state lives on <html> so the CSS can also
// move the sticky message field and submit button down into the freed space.
function useHideOnScrollDown(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const root = document.documentElement;
    let lastY = window.scrollY;
    function onScroll() {
      const y = window.scrollY;
      // Small movements (and the bounce at the top on iPhones) do not toggle the bar.
      if (Math.abs(y - lastY) < 8) return;
      if (y > lastY && y > 80) root.dataset.bottomBar = "hidden";
      else delete root.dataset.bottomBar;
      lastY = y;
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      delete root.dataset.bottomBar;
    };
  }, [enabled]);
}

export function TabBar({ tabs, activeTab, onSelect, placement = "top", stepStates }: TabBarProps) {
  useHideOnScrollDown(placement === "bottom");

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const index = tabs.indexOf(activeTab);
    const nextIndex =
      event.key === "ArrowRight" ? (index + 1) % tabs.length
      : event.key === "ArrowLeft" ? (index - 1 + tabs.length) % tabs.length
      : event.key === "Home" ? 0
      : event.key === "End" ? tabs.length - 1
      : null;
    if (nextIndex === null) return;
    event.preventDefault();
    onSelect(tabs[nextIndex]);
    document.getElementById(tabId(tabs[nextIndex]))?.focus();
  }

  return (
    <div
      role="tablist"
      id="task-tabs"
      // Top: a segmented control in a pill (docs/SPEC.md, section 9). Bottom: the floating
      // phone bar, styled in phoneLayout.css.
      className={placement === "bottom" ? "rl-bottom-tabs" : "inline-flex rounded-full bg-paper p-1 overflow-x-auto"}
      // The phone bar's white pill is one element that glides to the chosen tab (phoneLayout.css).
      style={placement === "bottom" ? ({ "--rl-tab-count": tabs.length, "--rl-tab-index": tabs.indexOf(activeTab) } as CSSProperties) : undefined}
    >
      {placement === "bottom" && <span className="rl-tab-glider" aria-hidden="true" />}
      {tabs.map((tab) => {
        const Icon = tabIcons[tab];
        return (
        <button
          key={tab}
          id={tabId(tab)}
          type="button"
          role="tab"
          aria-selected={tab === activeTab}
          aria-controls={panelId(tab)}
          tabIndex={tab === activeTab ? 0 : -1}
          onClick={() => onSelect(tab)}
          onKeyDown={handleKeyDown}
          className="rl-tab rounded-full px-4 sm:px-5 py-1.5 text-ink-muted whitespace-nowrap aria-selected:bg-surface aria-selected:text-ink aria-selected:font-semibold aria-selected:shadow-[var(--shadow-card)]"
        >
          <span className="rl-tab-icon-wrap relative">
            <Icon aria-hidden="true" className="rl-tab-icon" size={22} strokeWidth={2} absoluteStrokeWidth />
            {stepStates?.[tab] === "done" && (
              <span aria-hidden="true" className="rl-tab-badge rl-tab-badge-done">
                <Check size={9} strokeWidth={4} />
              </span>
            )}
            {stepStates?.[tab] === "next" && <span aria-hidden="true" className="rl-tab-badge rl-tab-badge-next" />}
          </span>
          <span>{tabLabels[tab]}</span>
          {stepStates?.[tab] === "done" && <span className="sr-only">, hotovo</span>}
          {stepStates?.[tab] === "next" && <span className="sr-only">, doporučený další krok</span>}
        </button>
        );
      })}
    </div>
  );
}
