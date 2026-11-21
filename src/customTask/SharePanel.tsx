import { useEffect, useState } from "react";
import { Share2 } from "lucide-react";
import { CopyButton } from "../components/CopyButton";
import { customTaskLink, fetchCustomTaskStatus, requestCustomTaskShare, type StatusOutcome } from "./customTaskApi";

// Sharing a generated task with colleagues (docs/SPEC.md, section 14): only after the author approves it.

const statusText: Record<string, string> = {
  none: "Úkol vidíš jen ty. Kolegům ho můžeš poslat, až sdílení schválí autor aplikace.",
  pending: "Žádost o sdílení čeká na schválení. Stav uvidíš na odkazu níže.",
  approved: "Sdílení je schválené. Pošli kolegům odkaz níže, úkol se jim otevře k vyřešení.",
  rejected: "Sdílení nebylo schváleno. Úkol dál můžeš řešit jen ty.",
};

export function SharePanel({ id }: { id: string }) {
  const [outcome, setOutcome] = useState<StatusOutcome | null>(null);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    let active = true;
    void fetchCustomTaskStatus(id).then((result) => active && setOutcome(result));
    return () => {
      active = false;
    };
  }, [id]);

  async function ask() {
    setAsking(true);
    setOutcome(await requestCustomTaskShare(id));
    setAsking(false);
  }

  const status = outcome?.kind === "ok" ? outcome.status : null;
  return (
    <section aria-labelledby="share-heading" className="card space-y-3">
      <h2 id="share-heading" className="flex items-center gap-2 text-base">
        <Share2 aria-hidden="true" size={18} className="text-progress" />
        Sdílení s kolegy
      </h2>
      <p role="status" className="text-sm">
        {outcome === null
          ? "Zjišťuji stav…"
          : outcome.kind === "missing"
            ? "Úkol už na serveru není. Vygenerované úkoly se mažou po 30 dnech."
            : outcome.kind === "error"
              ? outcome.message
              : statusText[outcome.status]}
      </p>
      {status === "none" && (
        <button type="button" onClick={ask} disabled={asking} className="rounded-full border border-line px-4 py-2 font-semibold disabled:opacity-50">
          {asking ? "Odesílám žádost…" : "Požádat o sdílení s kolegy"}
        </button>
      )}
      {outcome?.kind === "ok" && (
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <code className="rounded-control bg-paper px-2 py-1 break-all">{customTaskLink(id)}</code>
          <CopyButton getText={() => customTaskLink(id)} label="Kopírovat odkaz" />
        </p>
      )}
      <p className="text-xs text-ink-muted">Žádost neobsahuje tvoje jméno ani e-mail. Odkaz platí 30 dní od vygenerování úkolu.</p>
    </section>
  );
}
