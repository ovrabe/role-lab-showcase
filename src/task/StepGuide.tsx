import { Check } from "lucide-react";
import type { StepState } from "./taskProgress";
import type { TabId } from "./TabBar";

// The tabs can be used in any order, but the task has a natural one. This card only says it
// and ticks off what is done; it does not switch anything, so reading it never throws the
// person onto another screen. Moving between steps is the tab bar's job, which shows the
// same ticks. The numbers are fine here (docs/SPEC.md, section 9): this is a sequence.
const stepLabels: Record<TabId, string> = {
  brief: "Přečti zadání",
  materials: "Prohlédni podklady",
  assistant: "Pracuj s asistentem",
  submit: "Odevzdej výsledek",
};

export function StepGuide({ states, isWide }: { states: Record<TabId, StepState>; isWide: boolean }) {
  const tabs = Object.keys(stepLabels) as TabId[];
  return (
    <section aria-label="Jak postupovat" className="rounded-control bg-paper p-4 mb-3">
      <h3 className="text-sm font-semibold text-ink-muted mb-3">Jak postupovat</h3>
      <ol className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-2.5">
        {tabs.map((tab, index) => {
          const state = states[tab];
          return (
            <li
              key={tab}
              aria-current={state === "next" ? "step" : undefined}
              className={`flex items-center gap-2.5 text-sm ${state === "next" ? "text-ink font-semibold" : "text-ink-muted"}`}
            >
              <span
                aria-hidden="true"
                className={`shrink-0 grid place-items-center size-6 rounded-full text-xs font-semibold ${
                  state === "done"
                    ? "text-white bg-[image:var(--progress-sweep)]"
                    : state === "next"
                      ? "border-2 border-[var(--color-progress)] text-[var(--color-progress)]"
                      : "border border-line"
                }`}
              >
                {state === "done" ? <Check size={14} strokeWidth={3} /> : index + 1}
              </span>
              <span>
                {stepLabels[tab]}
                {state === "done" && <span className="sr-only"> (hotovo)</span>}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="text-sm text-ink-muted mt-3">
        {isWide
          ? "Zadání a podklady máš tady vlevo, asistenta vpravo, odevzdání dole. Pořadí není povinné."
          : "Kroky najdeš v liště dole, zleva doprava. Pořadí není povinné, mezi záložkami můžeš kdykoli přepínat."}
      </p>
    </section>
  );
}

// "What next" at the end of a tab: the forward path for anyone unsure where to go. No arrow
// in the label (docs/SPEC.md, section 9); the verb says where it leads.
export function NextStepButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <div className="mt-6 flex justify-end">
      <button
        type="button"
        onClick={onClick}
        className="rounded-full bg-action text-action-contrast px-5 py-2 font-medium"
      >
        {label}
      </button>
    </div>
  );
}
