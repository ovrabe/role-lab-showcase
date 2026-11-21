import { useState, type ChangeEvent } from "react";
import { FileSpreadsheet, ShieldCheck, TriangleAlert } from "lucide-react";
import { describeSummary, plural, summarizeFile, type DataSummary } from "../customTask/dataSummary";
import { requestCustomTask, type CustomTaskOutcome } from "../customTask/customTaskApi";
import { GeneratedPreview } from "../customTask/GeneratedPreview";
import { loadCustomTask, saveCustomTask, savedCustomConfigId } from "../customTask/savedCustomTask";
import { SharePanel } from "../customTask/SharePanel";
import { SharedTaskView } from "../customTask/SharedTaskView";
import { findSensitiveData } from "../customTask/sensitiveData";
import { SensitiveNotice } from "../customTask/SensitiveNotice";

// "Vlastní výzva" (docs/SPEC.md, section 14), step 1 and 2: the description and the optional
// table. Only the text in the preview leaves the browser. Step 3: the server generates the task.
// Step 4: the task opens on the usual task screen (onStart).

export const customTaskLimits = { role: 80, situation: 1500, deliverable: 500 };

const fieldClass = "w-full rounded-control border border-line bg-surface p-3 text-base";

/** What would be sent to the server, exactly as the person sees it in the preview. */
export function buildRequestText(role: string, situation: string, deliverable: string, data: string | null): string {
  return [`Role: ${role.trim()}`, `Situace: ${situation.trim()}`, `Co má výsledek obsahovat: ${deliverable.trim() || "neuvedeno"}`, data ? `\n${data}` : ""]
    .join("\n")
    .trim();
}

export function CustomTaskScreen({ onStart }: { onStart: (taskId: string) => void }) {
  // A link to someone else's task shows only that task (src/customTask/SharedTaskView.tsx).
  const linkedId = new URLSearchParams(window.location.search).get("vlastni-vyzva");
  const saved = loadCustomTask();
  if (linkedId && linkedId !== saved?.id) {
    return (
      <article className="max-w-2xl mx-auto space-y-6">
        <h1>Vlastní výzva</h1>
        <SharedTaskView id={linkedId} onStart={onStart} />
      </article>
    );
  }
  return <CustomTaskForm onStart={onStart} />;
}

function CustomTaskForm({ onStart }: { onStart: (taskId: string) => void }) {
  // The task generated earlier in this browser, so it can be opened again.
  const [saved, setSaved] = useState(loadCustomTask);
  const [role, setRole] = useState("");
  const [situation, setSituation] = useState("");
  const [deliverable, setDeliverable] = useState("");
  const [summary, setSummary] = useState<DataSummary | null>(null);
  const [leftOut, setLeftOut] = useState<Set<string>>(new Set());
  const [fileError, setFileError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [outcome, setOutcome] = useState<CustomTaskOutcome | null>(null);

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setFileError(null);
    setSummary(null);
    setLeftOut(new Set());
    setConfirmed(false);
    if (!file) return;
    try {
      setSummary(await summarizeFile(file));
    } catch (error) {
      setFileError(error instanceof Error && /MB|prázdná|tabulka/.test(error.message) ? error.message : "Soubor se nepodařilo přečíst. Zkus CSV nebo Excel.");
    }
  }

  async function generate() {
    setGenerating(true);
    setOutcome(null);
    const result = await requestCustomTask({ role: role.trim(), situation: situation.trim(), deliverable: deliverable.trim(), data: dataText });
    setGenerating(false);
    setOutcome(result);
    if (result.kind === "ok") {
      const next = { id: result.id, task: result.task };
      saveCustomTask(next);
      setSaved(next);
    }
  }

  function toggleColumn(name: string) {
    setConfirmed(false);
    setLeftOut((current) => {
      const next = new Set(current);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  const dataText = summary ? describeSummary(summary, leftOut) : null;
  const requestText = buildRequestText(role, situation, deliverable, dataText);
  const sensitive = findSensitiveData(requestText);
  const isComplete = role.trim().length >= 3 && situation.trim().length >= 40 && !sensitive.some((find) => find.blocking);

  return (
    <article className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="mb-2">
          Vlastní výzva <span className="align-middle rounded-full bg-paper px-2 py-0.5 text-sm font-normal">beta</span>
        </h1>
        <p className="text-ink-muted">
          Popiš svou roli a situaci z práce. Vygeneruje se z toho úkol na 15 minut s vymyšlenými daty a jednou záludností,
          který vyřešíš s AI asistentem stejně jako ostatní úkoly.
        </p>
      </div>

      <p className="flex gap-2 rounded-control bg-notice p-3 text-sm text-notice-ink">
        <TriangleAlert aria-hidden="true" size={18} className="mt-0.5 shrink-0" />
        Nepiš ani nenahrávej citlivé údaje: jména lidí a firem, osobní údaje, obchodní tajemství. Co sem napíšeš, odejde na
        server a k modelu. Z tabulky odejde jen to, co uvidíš v náhledu.
      </p>

      <label className="block">
        <span className="block font-semibold mb-1">Tvoje role</span>
        <input value={role} maxLength={customTaskLimits.role} onChange={(event) => setRole(event.target.value)} placeholder="Třeba nákupčí v síti lékáren" className={fieldClass} />
      </label>

      <label className="block">
        <span className="block font-semibold mb-1">Situace</span>
        <span className="block text-sm text-ink-muted mb-1">Co řešíš, s jakými daty, pro koho. Aspoň dvě věty.</span>
        <textarea value={situation} maxLength={customTaskLimits.situation} rows={5} onChange={(event) => setSituation(event.target.value)} className={fieldClass} />
      </label>

      <label className="block">
        <span className="block font-semibold mb-1">
          Co má výsledek obsahovat <span className="font-normal text-ink-muted">(nepovinné)</span>
        </span>
        <input value={deliverable} maxLength={customTaskLimits.deliverable} onChange={(event) => setDeliverable(event.target.value)} placeholder="Třeba krátký e-mail vedoucí s doporučením" className={fieldClass} />
      </label>

      <div>
        <span className="flex items-center gap-1.5 font-semibold mb-1">
          <FileSpreadsheet aria-hidden="true" size={18} />
          Tabulka jako vzor <span className="font-normal text-ink-muted">(nepovinné)</span>
        </span>
        <p className="text-sm text-ink-muted mb-2">
          CSV nebo Excel. Přečte se jen v tvém prohlížeči. Odejdou z ní jen názvy sloupců, typ hodnot a hrubé rozsahy, nikdy
          samotné hodnoty. Podle toho se vymyslí data, která vypadají podobně.
        </p>
        <input type="file" accept=".csv,.tsv,.txt,.xlsx,.xls,.ods" onChange={onFile} className="block text-sm" />
        {fileError && <p role="alert" className="mt-2 text-sm text-notice-ink">{fileError}</p>}
        {summary && (
          <fieldset className="mt-3 rounded-control border border-line p-3">
            <legend className="px-1 text-sm font-semibold">Které sloupce použít ({plural(summary.rows, "řádek", "řádky", "řádků")})</legend>
            <ul className="grid gap-1 sm:grid-cols-2">
              {summary.columns.map((column) => (
                <li key={column.name}>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={!leftOut.has(column.name)} onChange={() => toggleColumn(column.name)} />
                    {column.name} <span className="text-ink-muted">· {column.type}</span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        )}
      </div>

      <section aria-labelledby="preview-heading" className="card space-y-3">
        <h2 id="preview-heading" className="flex items-center gap-2 text-base">
          <ShieldCheck aria-hidden="true" size={18} className="text-progress" />
          Přesně tohle odejde na server
        </h2>
        <pre className="whitespace-pre-wrap rounded-control bg-paper p-3 font-mono text-xs leading-relaxed">{requestText || "Zatím nic."}</pre>
        <SensitiveNotice finds={sensitive} />
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={confirmed} disabled={!isComplete} onChange={(event) => setConfirmed(event.target.checked)} className="mt-1" />
          Náhled je zkontrolovaný a nejsou v něm citlivé údaje.
        </label>
        <button
          type="button"
          onClick={generate}
          disabled={!isComplete || !confirmed || generating}
          className="rl-submit-sweep rounded-full px-6 py-2.5 font-semibold disabled:opacity-50"
        >
          {generating ? "Generuji úkol…" : "Vygenerovat úkol"}
        </button>
        <p role="status" className="text-sm text-ink-muted">
          {generating ? "Obvykle to trvá do minuty. Stránku nezavírej." : "Jeden úkol denně. Bude označený jako nekalibrovaný."}
        </p>
        {outcome?.kind === "error" && (
          <p role="alert" className="rounded-control bg-notice p-3 text-sm text-notice-ink">
            {outcome.message}
          </p>
        )}
      </section>

      {saved && <GeneratedPreview task={saved.task} onStart={() => onStart(savedCustomConfigId(saved))} />}
      {saved && <SharePanel key={saved.id} id={saved.id} />}
    </article>
  );
}

