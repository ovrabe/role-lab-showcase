import { ExternalLink, Sparkles } from "lucide-react";
import type { ReactNode } from "react";

// The web address of the custom task: the claude.ai pages have no server, so they link there.
export const customTaskWebUrl = "https://role-lab-gamma.vercel.app/?vlastni-vyzva";

const cardClass =
  "soft-card mb-6 w-full flex items-center gap-3 px-4 py-3 text-left border-l-4 border-l-progress hover:-translate-y-0.5 transition-transform";

function CardContent({ note, end }: { note: string; end: ReactNode }) {
  return (
    <>
      <Sparkles aria-hidden="true" size={20} className="shrink-0 text-progress" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-progress">
          Vlastní výzva · <span className="rounded-full bg-paper px-2 py-0.5 text-xs">beta</span>
        </span>
        <span className="block font-semibold">Úkol na 15 minut podle tvé role a situace</span>
        <span className="block text-sm text-ink-muted">{note}</span>
      </span>
      {end}
    </>
  );
}

/**
 * The home page's way into "Vlastní výzva" (docs/SPEC.md, section 14). The web version opens
 * it here; the claude.ai pages, which have no server to generate and keep the task, link to
 * the web version in a new tab.
 */
export function CustomTaskCard({ onOpen }: { onOpen?: () => void }) {
  if (onOpen) {
    return (
      <button type="button" onClick={onOpen} className={cardClass}>
        <CardContent note="Nekalibrovaný, jeden denně. Pracuje jen s vymyšlenými daty." end={<span aria-hidden="true" className="text-xl">→</span>} />
      </button>
    );
  }
  return (
    <a href={customTaskWebUrl} target="_blank" rel="noopener noreferrer" className={cardClass}>
      <CardContent
        note="Běží na webové verzi Role Lab, otevře se v nové kartě. Nekalibrovaný, jeden denně."
        end={<ExternalLink aria-hidden="true" size={18} className="shrink-0 text-ink-muted" />}
      />
    </a>
  );
}
