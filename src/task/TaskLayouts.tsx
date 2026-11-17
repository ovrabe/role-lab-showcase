import type { ReactNode } from "react";
import { TabBar, panelId, tabId, type TabId } from "./TabBar";
import { AiIcon } from "../components/AiIcon";
import type { stepStates } from "./taskProgress";

// The two ways the task screen lays out its four panels (split out of TaskScreen.tsx).
type Panels = Record<TabId, ReactNode>;

/** Computer: brief and materials share the left column, the assistant and the submission are always visible. */
export function WideTaskLayout({ panels, leftTab, onSelect }: { panels: Panels; leftTab: TabId; onSelect: (tab: TabId) => void }) {
  return (
    // Reading surfaces are solid white cards on the pastel page (docs/SPEC.md, section 9).
    <div className="space-y-6">
      {/* Brief and assistant in a grid of their own: a sticky element stays within its
          parent, so the assistant stops at the end of the brief instead of sliding over
          the submission card below. */}
      <div className="grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-6">
        <div className="soft-card min-w-0 p-6">
          <TabBar tabs={["brief", "materials"]} activeTab={leftTab} onSelect={onSelect} />
          <div role="tabpanel" id={panelId(leftTab)} aria-labelledby={tabId(leftTab)} className="pt-6">
            {panels[leftTab]}
          </div>
        </div>
        {/* Sticky beside the brief and materials, so the chat stays in view while reading;
            its height fills the window (the chat in AssistantPanel is sized to match). */}
        <aside aria-label="Asistent" className="soft-card min-w-0 p-6 self-start sticky top-4">
          <h2 className="mb-3 flex items-center gap-2">
            <AiIcon size={20} />
            Asistent
          </h2>
          {panels.assistant}
        </aside>
      </div>
      <div className="soft-card p-6">
        <h2 className="mb-3">Odevzdání</h2>
        {panels.submit}
      </div>
    </div>
  );
}

type PhoneLayoutProps = {
  panels: Panels;
  activeTab: TabId;
  onSelect: (tab: TabId) => void;
  steps: ReturnType<typeof stepStates>;
  slideFrom: "left" | "right" | null;
};

/** Phone: every panel is a tab, with the tab bar at the bottom. */
export function PhoneTaskLayout({ panels, activeTab, onSelect, steps, slideFrom }: PhoneLayoutProps) {
  return (
    <div className="rl-phone-tabs">
      <TabBar tabs={["brief", "materials", "assistant", "submit"]} activeTab={activeTab} onSelect={onSelect} placement="bottom" stepStates={steps} />
      {/* All panels stay mounted and inactive ones are only hidden, so switching
          tabs never drops an answer that is still streaming. */}
      {(Object.keys(panels) as TabId[]).map((tab) => (
        <div
          key={tab}
          role="tabpanel"
          id={panelId(tab)}
          aria-labelledby={tabId(tab)}
          hidden={tab !== activeTab}
          className={`soft-card p-4 mt-2 ${tab === activeTab && slideFrom ? `rl-slide-from-${slideFrom}` : ""}`}
        >
          {panels[tab]}
        </div>
      ))}
    </div>
  );
}
