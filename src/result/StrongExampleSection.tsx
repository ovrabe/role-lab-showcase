import { useState } from "react";
import type { RoleConfig } from "../roles/roleSchema";
import { isParticipantBuild, isWebBuild } from "../buildFlags";
import { loadPreviewSamples } from "../evaluation/previewFixture";
import { apiHeaders } from "../ai/apiHeaders";
import { strongExampleFrom, type StrongExample } from "./strongExample";

/** Where the strong sample comes from: the page itself (claude.ai demo) or the project's server (web). */
async function loadStrongExample(role: RoleConfig): Promise<StrongExample | null> {
  if (isWebBuild) {
    const response = await fetch("/api/example", { method: "POST", headers: apiHeaders(), body: JSON.stringify({ roleId: role.id }) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = (await response.json()) as { kind: "ok"; example: StrongExample } | { kind: "none" };
    return body.kind === "ok" ? body.example : null;
  }
  const strong = loadPreviewSamples(role).find((sample) => sample.id === "strong");
  return strong?.session.evaluation ? strongExampleFrom(strong.session, strong.session.evaluation.output) : null;
}

// The claude.ai page for participants has neither samples nor a server.
export const canShowStrongExample = isWebBuild || !isParticipantBuild;

type State = { kind: "closed" } | { kind: "loading" } | { kind: "shown"; example: StrongExample } | { kind: "none" } | { kind: "error" };

/**
 * "Jak to řešil silný pokus": a made-up strong attempt of the same task beside the person's
 * own result, with what the evaluator praised in it. Loaded on request, after the evaluation.
 */
export function StrongExampleSection({ role }: { role: RoleConfig }) {
  const [state, setState] = useState<State>({ kind: "closed" });
  const areaName = (id: string) => role.rubric.find((dimension) => dimension.id === id)?.name ?? id;

  async function open() {
    setState({ kind: "loading" });
    try {
      const example = await loadStrongExample(role);
      setState(example ? { kind: "shown", example } : { kind: "none" });
    } catch {
      setState({ kind: "error" });
    }
  }

  return (
    <section aria-labelledby="strong-heading" className="card space-y-4">
      <div>
        <h2 id="strong-heading">Jak to řešil silný pokus</h2>
        <p className="text-ink-muted">Vymyšlený silný pokus o stejný úkol. Porovnej si ho se svým postupem.</p>
      </div>
      {state.kind === "closed" && (
        <button type="button" onClick={() => void open()} className="rounded-full border border-line px-4 py-2 hover:border-accent">
          Ukázat silný pokus
        </button>
      )}
      {state.kind === "loading" && <p className="text-ink-muted">Načítám…</p>}
      {state.kind === "none" && <p className="text-ink-muted">Pro tenhle úkol zatím silný pokus není.</p>}
      {state.kind === "error" && (
        <p className="text-ink-muted">
          Silný pokus se nepodařilo načíst.{" "}
          <button type="button" onClick={() => void open()} className="underline underline-offset-4">
            Zkusit znovu
          </button>
        </p>
      )}
      {state.kind === "shown" && (
        <div className="space-y-5">
          <div className="space-y-2">
            <h3>Zprávy asistentovi</h3>
            <ol className="space-y-2">
              {state.example.messages.map((message) => (
                <li key={message.turn} className="rounded-control bg-paper p-3 whitespace-pre-wrap">
                  <span className="text-sm text-ink-muted">Krok {message.turn}</span>
                  <br />
                  {message.text}
                </li>
              ))}
            </ol>
          </div>
          <div className="space-y-2">
            <h3>Odevzdaný výsledek</h3>
            <p className="rounded-control bg-paper p-3 whitespace-pre-wrap">{state.example.submission}</p>
          </div>
          <div className="space-y-3">
            <h3>Co na něm hodnotitel ocenil</h3>
            {state.example.dimensions.map((dimension) => (
              <div key={dimension.id} className="space-y-1">
                <p className="font-semibold">
                  {areaName(dimension.id)}: {dimension.score} ze 4
                </p>
                <ul className="space-y-1 text-ink-muted">
                  {dimension.quotes.map((quote) => (
                    <li key={`${quote.place}-${quote.quote}`}>
                      „{quote.quote}“ ({quote.place === "submission" ? "odevzdání" : `krok ${quote.place}`})
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
