import { Info } from "lucide-react";

// Preview mode (docs/SPEC.md, section 8) shown as a small pill in the header instead of a
// full-width strip. It also appears inside claude.ai when the viewer did not allow Claude,
// so it never disappears; a tap opens the explanation. The native popover closes on Escape
// and on a tap elsewhere without extra code.
export function PreviewPill() {
  return (
    <>
      <button
        type="button"
        popoverTarget="preview-explanation"
        className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-notice text-notice-ink px-3 py-1 text-xs font-semibold whitespace-nowrap"
      >
        <Info aria-hidden="true" size={14} />
        Náhled bez AI
      </button>
      <div id="preview-explanation" popover="auto" role="status" className="rl-preview-popover soft-card p-4 text-sm">
        <p className="font-semibold mb-1">Náhled bez AI</p>
        <p>
          Stránka běží mimo claude.ai, nebo v ní není povolený přístup ke Claudovi. Asistent proto neodpovídá a
          hodnocení se načte z ukázky. Všechno ostatní funguje.
        </p>
      </div>
    </>
  );
}
