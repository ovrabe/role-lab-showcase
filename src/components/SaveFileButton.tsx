import { useState } from "react";
import { saveTextFile } from "../runtime/fileSaver";

type SaveFileButtonProps = {
  label: string;
  filename: string;
  // Built only on click: an export is assembled from the current state at that moment.
  getContent: () => string;
  onSaved?: () => void;
  className?: string;
};

type Status = { kind: "idle" } | { kind: "notice"; message: string } | { kind: "fallback"; content: string };

export function SaveFileButton({ label, filename, getContent, onSaved, className }: SaveFileButtonProps) {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [isSaving, setIsSaving] = useState(false);

  async function save() {
    const content = getContent();
    setIsSaving(true);
    const outcome = await saveTextFile(filename, content);
    setIsSaving(false);
    if (outcome.kind === "saved") {
      setStatus({ kind: "idle" });
      onSaved?.();
    } else if (outcome.kind === "declined") {
      setStatus({ kind: "notice", message: "Stažení bylo zrušeno." });
    } else if (outcome.kind === "error") {
      setStatus({ kind: "notice", message: outcome.message });
    } else {
      setStatus({ kind: "fallback", content });
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => void save()}
        disabled={isSaving}
        className={className ?? "border border-line rounded-full px-4 py-1.5 text-sm bg-surface hover:border-accent disabled:opacity-50"}
      >
        {label}
      </button>
      {status.kind === "notice" && (
        <p role="status" className="text-sm text-ink-muted">
          {status.message}
        </p>
      )}
      {status.kind === "fallback" && (
        <div role="status" className="space-y-1">
          <p>Stahování tu není dostupné. Označ text níže a zkopíruj si ho.</p>
          <textarea
            readOnly
            value={status.content}
            rows={6}
            onFocus={(event) => event.target.select()}
            className="w-full font-mono text-xs rounded-control border border-line bg-surface p-2"
          />
        </div>
      )}
    </div>
  );
}
