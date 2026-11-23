import { useState, type FormEvent } from "react";
import { MessageCircleQuestion } from "lucide-react";
import { askData } from "./adminApi";
import { Markdown } from "../components/Markdown";

// "Zeptat se na data" (docs/PROMPTS.md, section 8): a question in plain words about the period's
// totals, answered by Claude from the same numbers the admin shows. Questions and answers stay
// only on this page; nothing is stored.

const suggestions = ["Kde lidé nejvíc odpadají?", "Který úkol je nejtěžší a proč?", "Která dovednost lidem jde nejhůř?", "Kolik stojí jeden dokončený pokus?"];

type Exchange = { question: string; answer: string | null; error?: string };

export function AskDataCard({ token, days }: { token: string; days: number }) {
  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState<Exchange[]>([]);
  const [busy, setBusy] = useState(false);

  async function ask(text: string) {
    const trimmed = text.trim();
    if (trimmed.length < 3 || busy) return;
    setBusy(true);
    setQuestion("");
    setHistory((current) => [{ question: trimmed, answer: null }, ...current]);
    const result = await askData(token, days, trimmed);
    setBusy(false);
    setHistory((current) => [
      result.ok ? { question: trimmed, answer: result.value.answer } : { question: trimmed, answer: null, error: result.message },
      ...current.slice(1),
    ]);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void ask(question);
  }

  return (
    <section aria-labelledby="ask-heading" className="rounded-[24px] bg-surface p-6 shadow-[var(--shadow-card)] space-y-4">
      <h2 id="ask-heading" className="flex items-center gap-2 text-lg font-bold">
        <MessageCircleQuestion aria-hidden="true" size={20} className="text-progress" /> Zeptat se na data
      </h2>
      <form onSubmit={submit} className="flex flex-wrap gap-2">
        <label className="flex-[1_1_320px] min-w-0">
          <span className="sr-only">Otázka</span>
          <input
            value={question}
            maxLength={500}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Proč u QA klesá ověřování?"
            className="w-full rounded-full border border-[var(--color-control-border)] bg-surface px-4 py-2.5"
          />
        </label>
        <button type="submit" disabled={busy || question.trim().length < 3} className="rounded-full bg-action text-action-contrast px-5 py-2.5 font-semibold disabled:opacity-50">
          {busy ? "Přemýšlím…" : "Zeptat se"}
        </button>
      </form>
      {history.length === 0 && (
        <div className="flex flex-wrap gap-2">
          {suggestions.map((suggestion) => (
            <button key={suggestion} type="button" onClick={() => void ask(suggestion)} className="rounded-full border border-line bg-paper px-3 py-1.5 text-sm">
              {suggestion}
            </button>
          ))}
        </div>
      )}
      {history.map((exchange, index) => (
        <div key={history.length - index} className="space-y-1.5 rounded-[16px] bg-paper p-4">
          <p className="text-sm font-semibold">{exchange.question}</p>
          {exchange.answer ? (
            // Short lists and bold text from the model, rendered without any HTML from the reply.
            <div className="text-sm leading-relaxed">
              <Markdown text={exchange.answer} />
            </div>
          ) : (
            <p className="text-sm">{exchange.error ?? "Přemýšlím…"}</p>
          )}
        </div>
      ))}
      <p className="text-xs text-ink-muted">Odpovídá Claude jen z anonymních součtů za vybrané období. Otázky se neukládají, nejvýš 50 denně.</p>
    </section>
  );
}
