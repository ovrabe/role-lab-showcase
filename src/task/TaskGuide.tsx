import { useState } from "react";
import { CircleHelp } from "lucide-react";
import { FirstVisitGuide, hasSeenGuide, type GuideStep } from "../home/FirstVisitGuide";

// The first-visit guide on a task (src/home/FirstVisitGuide.tsx): where the brief and the data
// are, where to work with AI, where the result goes. Shown on the first task only; the "?"
// beside "Začít znovu" repeats it. On a computer the steps point at the tabs, the assistant
// panel and the submission card; on a phone at the tabs in the bottom bar (TaskLayouts.tsx).
// The second step says to check the AI's work, but not that the data hide traps: whether the
// person checks on their own is what the evaluation measures.

const storageKey = "role-lab:guide:task";

const steps: GuideStep[] = [
  {
    // The Zadání tab alone: the whole tab bar (on a phone all four tabs) said less where to look.
    target: "task-brief",
    title: "Nejdřív zadání a data",
    text: "V Zadání je situace a co máš odevzdat. V Podkladech jsou data. Přilož je asistentovi, ať s nimi může počítat.",
  },
  {
    target: "task-assistant",
    title: "Tady pracuješ s AI",
    text: "Ptej se, nech si počítat a navrhovat, ale výsledky ověřuj. Hodnotí se i to, jak s AI pracuješ, nejen co odevzdáš.",
  },
  {
    target: "task-submit",
    title: "Výsledek patří sem, ne do chatu",
    text: "Až budeš mít hotovo, vlož výsledek sem a odevzdej. Pak už úkol nejde měnit. Hodnocení trvá do minuty.",
  },
];

export const taskGuideSteps = steps;

export function useTaskGuide() {
  const [isOpen, setIsOpen] = useState(() => !hasSeenGuide(storageKey));
  return {
    button: (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="Jak na úkol"
        title="Jak na úkol"
        className="inline-flex items-center gap-1 text-ink-muted hover:text-ink"
      >
        <CircleHelp aria-hidden="true" size={18} />
        <span className="text-sm">Jak na úkol</span>
      </button>
    ),
    guide: isOpen ? <FirstVisitGuide steps={steps} storageKey={storageKey} onClose={() => setIsOpen(false)} /> : null,
  };
}
