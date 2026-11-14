import { useState } from "react";
import type { DimensionId, RoleConfig } from "../roles/roleSchema";
import type { StoredEvaluation } from "../evaluation/evaluationSchema";
import { computeLevel } from "../evaluation/computeLevel";
import { readItem, writeItem } from "../session/sessionStorage";

type Rating = "yes" | "rather_yes" | "rather_no" | "no";
type SendState = "idle" | "sending" | "sent" | "limit" | "error";

const ratings: { value: Rating; label: string }[] = [
  { value: "yes", label: "Ano" },
  { value: "rather_yes", label: "Spíš ano" },
  { value: "rather_no", label: "Spíš ne" },
  { value: "no", label: "Ne" },
];

type EvaluationFeedbackProps = { role: RoleConfig; evaluation: StoredEvaluation };

/**
 * "Odpovídá hodnocení tvé práci?" (docs/PRODUCTION.md, part 10, phase 1). Web version only:
 * the answer goes to the project's server (/api/feedback) with the AI scores, never with
 * the conversation. Asked once per evaluation.
 */
export function EvaluationFeedback({ role, evaluation }: EvaluationFeedbackProps) {
  const sentKey = `role-lab:rated:${role.id}:${evaluation.evaluatedAt}`;
  const [rating, setRating] = useState<Rating | null>(null);
  const [disagree, setDisagree] = useState<DimensionId[]>([]);
  const [comment, setComment] = useState("");
  const [state, setState] = useState<SendState>(() => (readItem(sentKey) ? "sent" : "idle"));

  // After sending, say plainly what happens with the answer, so it does not vanish into nowhere.
  if (state === "sent") {
    return (
      <section aria-labelledby="evaluation-feedback-heading" className="card space-y-3">
        <h2 id="evaluation-feedback-heading">Díky, odpověď je uložená</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>Přečte si ji autor Role Lab.</li>
          <li>Když se nesouhlas u stejné oblasti opakuje, upraví pravidla hodnotitele a znovu je vyzkouší na vzorových pokusech.</li>
          <li>Tvoje hodnocení ani úrovně dovedností se tím nemění.</li>
        </ul>
      </section>
    );
  }

  const scores = Object.fromEntries(evaluation.output.dimensions.map((dimension) => [dimension.id, dimension.score])) as Record<
    DimensionId,
    number
  >;

  function toggleArea(id: DimensionId) {
    setDisagree((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  async function send() {
    if (!rating || state === "sending") return;
    setState("sending");
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "evaluation",
          rating,
          disagree: rating === "yes" ? [] : disagree,
          comment: comment.trim() || undefined,
          roleId: role.id,
          level: computeLevel(role, scores).level,
          scores,
        }),
      });
      if (response.ok) writeItem(sentKey, "1");
      setState(response.ok ? "sent" : response.status === 429 ? "limit" : "error");
    } catch {
      setState("error");
    }
  }

  return (
    <section aria-labelledby="evaluation-feedback-heading" className="card space-y-4">
      <div>
        <h2 id="evaluation-feedback-heading" className="mb-1">
          Odpovídá hodnocení tvé práci?
        </h2>
        <p className="text-ink-muted">
          Hodnocení navrhla AI a může se splést. Když podle tebe něco přehlédla nebo špatně pochopila, dej vědět. Tvoje
          výsledky se tím nezmění, odpověď slouží ke zlepšení hodnotitele.
        </p>
      </div>

      <div role="group" aria-label="Odpovídá hodnocení tvé práci?" className="flex flex-wrap gap-2">
        {ratings.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={rating === option.value}
            onClick={() => setRating(option.value)}
            className="rounded-full border border-line bg-surface px-4 py-2 aria-pressed:bg-action aria-pressed:text-action-contrast aria-pressed:border-transparent"
          >
            {option.label}
          </button>
        ))}
      </div>

      {rating && rating !== "yes" && (
        <fieldset>
          <legend className="font-medium mb-1">Ve které oblasti se hodnotitel podle tebe spletl? (nepovinné)</legend>
          <p className="text-sm text-ink-muted mb-2">
            Projdi zdůvodnění u oblastí výš. Dobrý důvod k nesouhlasu je, když v záznamu práce je něco, co hodnotitel
            nezmínil.
          </p>
          <div className="flex flex-wrap gap-2">
            {role.rubric.map((dimension) => (
              <label
                key={dimension.id}
                className="inline-flex items-center gap-2 rounded-full border border-line px-3 py-1.5 text-sm has-[:checked]:border-[var(--color-control-border)] has-[:checked]:bg-paper"
              >
                <input type="checkbox" checked={disagree.includes(dimension.id)} onChange={() => toggleArea(dimension.id)} />
                {dimension.name}
                <span className="text-ink-muted tabular-nums">{scores[dimension.id]} ze 4</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {rating && (
        <>
          <label className="block">
            <span className="block font-medium mb-1">
              {rating === "yes" ? "Chceš něco dodat? (nepovinné)" : "Co hodnotitel přehlédl nebo posoudil špatně? (nepovinné)"}
            </span>
            <textarea
              value={comment}
              placeholder={rating === "yes" ? "" : "Například: v kroku 12 je ověření dat, které hodnotitel nezmínil."}
              onChange={(event) => setComment(event.target.value)}
              maxLength={2000}
              rows={3}
              className="w-full rounded-control border border-line bg-surface p-3 text-base"
            />
          </label>
          <p className="text-sm text-ink-muted">Uloží se jen tvoje odpověď a skóre, ne záznam práce.</p>
          {state === "limit" && (
            <p role="alert" className="bg-notice text-notice-ink rounded-control p-3">
              Dnešní limit zpráv je vyčerpaný. Zkus to prosím zítra.
            </p>
          )}
          {state === "error" && (
            <p role="alert" className="bg-notice text-notice-ink rounded-control p-3">
              Odpověď se nepodařilo odeslat. Zkus to prosím znovu.
            </p>
          )}
          <button
            type="button"
            onClick={send}
            disabled={state === "sending"}
            className="rounded-full bg-action text-action-contrast px-5 py-2 font-semibold disabled:opacity-50"
          >
            {state === "sending" ? "Odesílám…" : "Odeslat"}
          </button>
        </>
      )}
    </section>
  );
}
