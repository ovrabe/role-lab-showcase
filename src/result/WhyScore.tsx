import { useState } from "react";
import { HelpCircle } from "lucide-react";
import type { StoredWhy, WhyOutcome } from "../evaluation/whyAnswer";

export type WhyControls = {
  answers: Record<string, StoredWhy>;
  ask: (dimensionId: string) => Promise<WhyOutcome>;
};

/**
 * "Proč tohle skóre?" under one area of the result (docs/PROMPTS.md, section 5). Asked on a
 * click only; the answer is stored with the attempt, so it shows again without a new call.
 */
export function WhyScore({ dimensionId, why }: { dimensionId: string; why: WhyControls }) {
  const [state, setState] = useState<{ kind: "idle" } | { kind: "asking" } | { kind: "error"; message: string }>({ kind: "idle" });
  const answer = why.answers[dimensionId];

  async function ask() {
    setState({ kind: "asking" });
    const outcome = await why.ask(dimensionId);
    setState(outcome.kind === "ok" ? { kind: "idle" } : { kind: "error", message: outcome.message || "Vysvětlení se nepodařilo. Zkus to znovu." });
  }

  if (answer) {
    return (
      <div className="rounded-control bg-paper p-3 space-y-2">
        <p className="font-semibold flex items-center gap-2">
          <HelpCircle aria-hidden="true" size={16} className="text-progress" />
          Proč tohle skóre
        </p>
        <p>{answer.answer}</p>
        {answer.quotes.length > 0 && (
          <ul className="space-y-1 text-sm text-ink-muted">
            {answer.quotes.map((quote) => (
              <li key={`${quote.place}-${quote.quote}`}>
                „{quote.quote}“ ({quote.place === "submission" ? "odevzdání" : `krok ${quote.place}`})
                {!quote.verified && <span className="ml-1 font-semibold">· citace se v záznamu nenašla</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => void ask()}
        disabled={state.kind === "asking"}
        className="inline-flex items-center gap-1.5 text-sm text-accent underline-offset-4 hover:underline disabled:opacity-60"
      >
        <HelpCircle aria-hidden="true" size={16} />
        {state.kind === "asking" ? "Ptám se hodnotitele…" : "Proč tohle skóre?"}
      </button>
      {state.kind === "error" && (
        <p role="status" className="text-sm text-ink-muted">
          {state.message}
        </p>
      )}
    </div>
  );
}
