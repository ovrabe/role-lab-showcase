import { useState } from "react";
import { decideShare, setGeneration, type AdminOverview } from "./adminApi";

// "Ke schválení": shared custom tasks waiting for a decision, the generation switch and the
// log of the author's actions. After every action the overview is loaded again (onChanged).

const actionNames: Record<string, string> = {
  share_approved: "Sdílení schváleno",
  share_rejected: "Sdílení zamítnuto",
  generation_off: "Generování vypnuto",
  generation_on: "Generování zapnuto",
};

const when = (iso: string) => (iso ? new Date(iso).toLocaleString("cs-CZ", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" }) : "");

export function ApprovalsTab({ data, token, onChanged }: { data: AdminOverview; token: string; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<{ ok: boolean; message?: string }>) {
    setBusy(true);
    setError(null);
    const result = await action();
    setBusy(false);
    if (!result.ok) setError(result.message ?? "Akce se nepovedla.");
    onChanged();
  }

  return (
    <div className="space-y-6">
      {error && <p role="alert" className="rounded-control bg-notice p-3 text-sm text-notice-ink">{error}</p>}
      <section className="card flex flex-wrap items-center justify-between gap-3">
        <p>
          Generování vlastních výzev je <strong>{data.generationOff ? "vypnuté" : "zapnuté"}</strong>. Vypnutí zastaví jen nové úkoly.
        </p>
        <button type="button" disabled={busy} onClick={() => run(() => setGeneration(token, !data.generationOff))} className="rounded-full border border-line px-4 py-2 font-semibold disabled:opacity-50">
          {data.generationOff ? "Zapnout" : "Vypnout"}
        </button>
      </section>

      <h2 className="text-base font-semibold">Žádosti o sdílení ({data.pendingShares.length})</h2>
      {data.pendingShares.length === 0 && <p className="card text-sm text-ink-muted">Nic nečeká na schválení.</p>}
      {data.pendingShares.map((share) => (
        <article key={share.id} className="card space-y-2">
          <p className="text-sm text-ink-muted">
            {share.roleTitle} · žádost {when(share.requestedAt)} · <code>{share.id}</code>
          </p>
          <h3 className="font-semibold">{share.title}</h3>
          <p className="text-sm">{share.brief.situation}</p>
          <p className="text-sm font-semibold">{share.brief.task}</p>
          <p className="text-sm rounded-control bg-paper p-2">
            <span className="font-semibold">Záludnost:</span> {share.trap}
          </p>
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={() => run(() => decideShare(token, share.id, "approved"))} className="rounded-full bg-action text-action-contrast px-4 py-2 font-semibold disabled:opacity-50">
              Schválit
            </button>
            <button type="button" disabled={busy} onClick={() => run(() => decideShare(token, share.id, "rejected"))} className="rounded-full border border-line px-4 py-2 font-semibold disabled:opacity-50">
              Zamítnout
            </button>
          </div>
        </article>
      ))}

      <h2 className="text-base font-semibold">Log akcí</h2>
      {data.log.length === 0 ? (
        <p className="card text-sm text-ink-muted">Zatím žádná akce.</p>
      ) : (
        <ul className="card text-sm space-y-1">
          {data.log.map((entry, index) => (
            <li key={index}>
              {when(entry.at)} · {actionNames[entry.action] ?? entry.action}
              {entry.detail ? ` · ${entry.detail}` : ""}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
