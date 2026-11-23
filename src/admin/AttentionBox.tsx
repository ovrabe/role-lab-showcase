import { CheckCircle2, Info, TriangleAlert } from "lucide-react";
import type { AttentionItem } from "./attention";

// "Co řešit": the top of the admin overview. A warning has its icon and a label, never colour alone.

const tabNames: Record<AttentionItem["tab"], string> = {
  overview: "Přehled", tasks: "Úkoly", models: "Modely a útrata", approvals: "Ke schválení", feedback: "Zpětná vazba",
};

export function AttentionBox({ items, onOpenTab }: { items: AttentionItem[]; onOpenTab: (tab: AttentionItem["tab"]) => void }) {
  return (
    <section aria-labelledby="attention-heading" className="h-full rounded-[24px] bg-surface p-6 shadow-[var(--shadow-card)] space-y-3">
      <h2 id="attention-heading" className="text-lg font-bold">Co řešit{items.length > 0 ? ` · ${items.length}` : ""}</h2>
      {items.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-ink-muted">
          <CheckCircle2 aria-hidden="true" size={16} /> Nic nevyžaduje pozornost.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((item, index) => (
            <li key={index} className={`flex items-start gap-2 rounded-[16px] p-3 text-sm ${item.level === "warning" ? "bg-notice text-notice-ink" : "bg-paper"}`}>
              {item.level === "warning" ? <TriangleAlert aria-hidden="true" size={16} className="mt-0.5 shrink-0" /> : <Info aria-hidden="true" size={16} className="mt-0.5 shrink-0 text-ink-muted" />}
              <span className="flex-1">
                <span className="sr-only">{item.level === "warning" ? "Upozornění: " : "Informace: "}</span>
                {item.text}
              </span>
              {item.tab !== "overview" && (
                <button type="button" onClick={() => onOpenTab(item.tab)} className="shrink-0 underline underline-offset-4">
                  {tabNames[item.tab]}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
