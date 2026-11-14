import { useState } from "react";
import { Check, Copy } from "lucide-react";

type CopyButtonProps = { getText: () => string; label: string };

/**
 * Copies text to the clipboard and confirms it for a moment. Inside the claude.ai app the
 * page runs in a frame where the Clipboard API can be blocked, so an older way is the backup.
 */
export function CopyButton({ getText, label }: CopyButtonProps) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  async function copy() {
    const text = getText();
    let copied = false;
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
    } catch {
      copied = copyWithSelection(text);
    }
    setState(copied ? "copied" : "failed");
    window.setTimeout(() => setState("idle"), 2000);
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs text-ink-muted hover:bg-paper hover:text-ink"
    >
      {state === "copied" ? <Check aria-hidden="true" size={14} /> : <Copy aria-hidden="true" size={14} />}
      <span aria-live="polite">{state === "copied" ? "Zkopírováno" : state === "failed" ? "Kopírování se nepovedlo" : label}</span>
    </button>
  );
}

function copyWithSelection(text: string): boolean {
  const field = document.createElement("textarea");
  field.value = text;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.opacity = "0";
  document.body.appendChild(field);
  field.select();
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    field.remove();
  }
}
