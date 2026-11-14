import { useMemo, useState, type ReactNode } from "react";
import type { RoleConfig } from "../roles/roleSchema";
import { loadPreviewSamples } from "../evaluation/previewFixture";
import { ResultScreen } from "./ResultScreen";

type SampleViewerProps = {
  role: RoleConfig;
  // Shown above the sample buttons until a sample is opened.
  intro?: ReactNode;
};

/**
 * Sample runs of a role (fixtures/<role>.preview-*.json): one button per sample and
 * the result of the chosen one. Needs no Claude call, so it works in preview and in claude.ai.
 * Samples reveal the data traps, so they are never offered to people before their own task.
 */
export function SampleViewer({ role, intro }: SampleViewerProps) {
  const samples = useMemo(() => loadPreviewSamples(role), [role]);
  const [shownId, setShownId] = useState<string | null>(null);
  const shown = samples.find((sample) => sample.id === shownId);

  if (samples.length === 0) {
    return <p className="text-ink-muted">Pro roli {role.title} zatím není žádná ukázka.</p>;
  }

  // With several samples (weak, strong) a demo can switch between them.
  const sampleButtons = (
    // The same pill switch as Zadání / Podklady in the task.
    <div className="inline-flex flex-wrap rounded-full bg-paper p-1">
      {samples.map((sample) => (
        <button
          key={sample.id}
          type="button"
          onClick={() => setShownId(sample.id)}
          aria-pressed={sample.id === shownId}
          className={`rounded-full px-4 py-1.5 ${
            sample.id === shownId ? "bg-surface text-ink font-semibold shadow-[var(--shadow-card)]" : "text-ink-muted hover:text-ink"
          }`}
        >
          {samples.length === 1 ? "Zobrazit ukázkové hodnocení" : `Ukázka: ${sample.label}`}
        </button>
      ))}
    </div>
  );

  if (!shown) {
    return (
      <div className="space-y-3">
        {intro}
        {sampleButtons}
      </div>
    );
  }
  return (
    <div className="space-y-6 max-w-none">
      <p role="note" className="bg-notice text-notice-ink rounded-control p-3">
        <strong>Ukázka, ne tvoje práce.</strong> Záznam, odevzdání i hodnocení patří vymyšlenému člověku. Úpravy v
        režimu hodnotitele se u ukázky neukládají.
      </p>
      {samples.length > 1 && sampleButtons}
      {/* key: switching samples starts with a fresh result screen (no carried-over selection or review). */}
      <ResultScreen key={shown.id} role={role} session={shown.session} />
    </div>
  );
}
