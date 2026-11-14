import { useEffect, useRef } from "react";
import { FileSpreadsheet, FileText, Paperclip, Check } from "lucide-react";
import type { Material } from "../roles/roleSchema";
import { getMaterialText } from "../materials/materialFiles";
import { SaveFileButton } from "../components/SaveFileButton";
import { CsvTableView } from "./CsvTableView";
import { Markdown } from "../components/Markdown";

type MaterialCallbacks = {
  onViewed: (materialId: string) => void;
  onDownloaded: (materialId: string) => void;
  onAttach: (materialId: string) => void;
  // Materials waiting to be sent with the next chat message.
  pendingAttachmentIds: string[];
};

export function MaterialsPanel({ materials, ...callbacks }: { materials: Material[] } & MaterialCallbacks) {
  return (
    <div className="space-y-10">
      {materials.map((material) => (
        <MaterialView key={material.id} material={material} {...callbacks} />
      ))}
    </div>
  );
}

function MaterialView({
  material,
  onViewed,
  onDownloaded,
  onAttach,
  pendingAttachmentIds,
}: { material: Material } & MaterialCallbacks) {
  const isAttached = pendingAttachmentIds.includes(material.id);
  // loadRoles already rejects roles with missing files, so this is only a guard.
  const text = getMaterialText(material.file) ?? "";
  const facts = [material.period, material.rows ? `${material.rows} řádků` : undefined].filter(Boolean);
  const sectionRef = useRef<HTMLElement>(null);

  // A material counts as viewed once it actually appears on screen, not when the tab opens:
  // with several materials stacked, the lower ones may never be scrolled to.
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        onViewed(material.id);
        observer.disconnect();
      }
    });
    observer.observe(section);
    return () => observer.disconnect();
  }, [material.id, onViewed]);

  return (
    <section ref={sectionRef} aria-labelledby={`material-${material.id}`}>
      {/* A file card, as in ColorOS: a type icon, the name, the facts and the actions. */}
      <div className="rounded-control bg-paper p-4 mb-3 flex flex-wrap items-center gap-x-4 gap-y-3">
        <span
          aria-hidden="true"
          className="shrink-0 grid place-items-center size-12 rounded-control bg-surface text-accent"
        >
          {material.type === "csv" ? <FileSpreadsheet size={24} strokeWidth={1.7} /> : <FileText size={24} strokeWidth={1.7} />}
        </span>
        <div className="min-w-0 flex-1">
          <h3 id={`material-${material.id}`}>
            {material.title}
          </h3>
          {facts.length > 0 && <p className="text-sm text-ink-muted">{facts.join(" · ")}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onAttach(material.id)}
            disabled={isAttached}
            className="inline-flex items-center gap-1.5 rounded-full bg-action text-action-contrast px-4 py-1.5 text-sm font-medium disabled:opacity-60"
          >
            {isAttached ? <Check aria-hidden="true" size={15} /> : <Paperclip aria-hidden="true" size={15} />}
            {isAttached ? "Přiloženo k další zprávě" : "Přiložit do konverzace"}
          </button>
          {/* Counted as downloaded only when the viewer really saved it. */}
          <SaveFileButton
            label="Stáhnout"
            filename={material.file.split("/").pop() ?? `${material.id}.txt`}
            getContent={() => text}
            onSaved={() => onDownloaded(material.id)}
          />
        </div>
      </div>

      {material.dictionary && material.dictionary.length > 0 && (
        <details className="mb-3 text-sm">
          <summary className="cursor-pointer text-accent underline-offset-4 hover:underline">
            Co znamenají sloupce
          </summary>
          <dl className="mt-2 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1">
            {material.dictionary.map((entry) => (
              <div key={entry.column} className="contents">
                <dt className="font-mono">{entry.column}</dt>
                <dd className="text-ink-muted">{entry.meaning}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}

      {material.type === "csv" ? (
        <CsvTableView text={text} caption={material.title} />
      ) : (
        // Same renderer as the assistant's answers; wide tables scroll inside their own box on a phone.
        <div className="bg-surface border border-line rounded-control p-4">
          <Markdown text={text} />
        </div>
      )}
    </section>
  );
}
