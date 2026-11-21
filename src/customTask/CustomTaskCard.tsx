import { Sparkles } from "lucide-react";

/** The home page's way into "Vlastní výzva" (docs/SPEC.md, section 14). Web version only: it needs the server. */
export function CustomTaskCard({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="soft-card mb-6 w-full flex items-center gap-3 px-4 py-3 text-left border-l-4 border-l-progress hover:-translate-y-0.5 transition-transform"
    >
      <Sparkles aria-hidden="true" size={20} className="shrink-0 text-progress" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-progress">
          Vlastní výzva · <span className="rounded-full bg-paper px-2 py-0.5 text-xs">beta</span>
        </span>
        <span className="block font-semibold">Úkol na 15 minut podle tvé role a situace</span>
        <span className="block text-sm text-ink-muted">Nekalibrovaný, jeden denně. Pracuje jen s vymyšlenými daty.</span>
      </span>
      <span aria-hidden="true" className="text-xl">→</span>
    </button>
  );
}
