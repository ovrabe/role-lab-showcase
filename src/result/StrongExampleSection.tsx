import { useState } from "react";
import type { RoleConfig } from "../roles/roleSchema";
import { isParticipantBuild, isWebBuild } from "../buildFlags";
import { loadPreviewSamples } from "../evaluation/previewFixture";
import { apiHeaders } from "../ai/apiHeaders";
import { strongExampleFrom, type StrongExample } from "./strongExample";
import type { StoredEvaluation } from "../evaluation/evaluationSchema";

/** Where the strong sample comes from: the page itself (claude.ai demo) or the project's server (web). */
// "needsEvaluation": the server gives the sample only with the token from an evaluation of this
// task. A result from 2.5.1 or earlier has none, and a token stops matching when the server's
// key changes; both are fixed by evaluating the task again, so retrying now would not help.
async function loadStrongExample(role: RoleConfig, evaluation: StoredEvaluation): Promise<StrongExample | null | "needsEvaluation"> {
  if (isWebBuild) {
    if (!evaluation.exampleToken) return "needsEvaluation";
    const request = JSON.stringify({ roleId: role.id, token: evaluation.exampleToken });
    const response = await fetch("/api/example", { method: "POST", headers: apiHeaders(), body: request });
    // Only "not evaluated" means the token: another 403 (a foreign page) is an ordinary error.
    if (response.status === 403) {
      const code = ((await response.clone().json().catch(() => null)) as { error?: { code?: string } } | null)?.error?.code;
      if (code === "not_evaluated") return "needsEvaluation";
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = (await response.json()) as { kind: "ok"; example: StrongExample } | { kind: "none" };
    return body.kind === "ok" ? body.example : null;
  }
  const strong = loadPreviewSamples(role).find((sample) => sample.id === "strong");
  return strong?.session.evaluation ? strongExampleFrom(strong.session, strong.session.evaluation.output) : null;
}

// The claude.ai page for participants has neither samples nor a server.
export const canShowStrongExample = isWebBuild || !isParticipantBuild;

type State = { kind: "closed" } | { kind: "loading" } | { kind: "shown"; example: StrongExample } | { kind: "none" } | { kind: "needsEvaluation" } | { kind: "error" };

/**
 * "Jak to řešil silný pokus": a made-up strong attempt of the same task beside the person's
 * own result, with what the evaluator praised in it. Loaded on request, after the evaluation.
 */
export function StrongExampleSection({ role, evaluation }: { role: RoleConfig; evaluation: StoredEvaluation }) {
  const [state, setState] = useState<State>({ kind: "closed" });
  const areaName = (id: string) => role.rubric.find((dimension) => dimension.id === id)?.name ?? id;

  async function open() {
    setState({ kind: "loading" });
    try {
      const example = await loadStrongExample(role, evaluation);
      setState(example === "needsEvaluation" ? { kind: "needsEvaluation" } : example ? { kind: "shown", example } : { kind: "none" });
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
      {/* A live region that stays on the page: loading, errors and the sample are read out. */}
      <div aria-live="polite" className="space-y-4">
        {state.kind === "closed" && (
          <button type="button" onClick={() => void open()} className="rounded-full border border-line px-4 py-2 hover:border-accent">
            Ukázat silný pokus
          </button>
        )}
        {state.kind === "loading" && (
          <p className="text-ink-muted">Načítám…</p>
        )}
        {state.kind === "none" && <p className="text-ink-muted">Pro tenhle úkol zatím silný pokus není.</p>}
        {state.kind === "needsEvaluation" && (
          <p className="text-ink-muted">U staršího výsledku se silný pokus ukázat nedá. Uvidíš ho u dalšího hodnocení tohohle úkolu.</p>
        )}
        {state.kind === "error" && (
          <p className="text-ink-muted">
            Silný pokus se nepodařilo načíst.{" "}
            <button type="button" onClick={() => void open()} className="underline underline-offset-4">
              Zkusit znovu
            </button>
          </p>
        )}
        {state.kind === "shown" && (
          // Focus stays on the page; the heading tells a screen reader the sample is there.
          <div className="space-y-5" aria-label="Silný pokus">
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
      </div>
    </section>
  );
}
