import type { ReactNode } from "react";
import { Compass, FileCheck2, Lightbulb, Target, type LucideIcon } from "lucide-react";
import type { RoleConfig } from "../roles/roleSchema";

// The brief as four tiles with an icon each, so the screen reads in blocks rather than as
// one long text (docs/SPEC.md, section 9). The tint colours come from the AI colour sweep.
export function BriefPanel({ role }: { role: RoleConfig }) {
  const { brief } = role;
  return (
    <div className="grid gap-3">
      <BriefTile icon={Compass} tint="#ff7a45" title="Situace">
        <p>{brief.situation}</p>
      </BriefTile>
      <BriefTile icon={Target} tint="#e5489b" title="Úkol">
        <p>{brief.task}</p>
      </BriefTile>
      <BriefTile icon={FileCheck2} tint="#8a5cf6" title="Co odevzdáváš">
        <p>{brief.deliverable}</p>
      </BriefTile>
      <BriefTile icon={Lightbulb} tint="#3d7bff" title="Jak pracovat">
        <p className="mb-2">{brief.howToWork}</p>
        <p className="text-ink-muted">{brief.dataNote}</p>
      </BriefTile>
    </div>
  );
}

function BriefTile({ icon: Icon, tint, title, children }: { icon: LucideIcon; tint: string; title: string; children: ReactNode }) {
  return (
    // The icon sits beside the heading and the text runs below at full width, so on a
    // phone the text is not squeezed into a narrow column next to the icon.
    <section className="rounded-control bg-paper p-4 sm:p-5">
      <div className="flex items-center gap-3 mb-2">
        <span
          aria-hidden="true"
          className="shrink-0 grid place-items-center size-9 rounded-full"
          style={{ backgroundColor: `color-mix(in srgb, ${tint} 16%, transparent)`, color: tint }}
        >
          <Icon size={18} strokeWidth={1.9} />
        </span>
        <h3>{title}</h3>
      </div>
      <div className="sm:pl-12">{children}</div>
    </section>
  );
}
