import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { reportAnswers, scenarioSteps, type ScenarioAnswers, type ScenarioQuestion } from "../testing/testerScenario";
import { apiHeaders } from "../ai/apiHeaders";

// The tester scenario (?testovani, web version only): the tester goes through the app in
// another tab and answers here; one click sends everything to the author's backlog.
// The draft is kept in this browser only, so going back and forth loses nothing.

const draftKey = "role-lab:tester-scenario";
type SendState = "idle" | "sending" | "sent" | "limit" | "error";

function loadDraft(): { answers: ScenarioAnswers; contact: string } {
  try {
    const stored = JSON.parse(window.localStorage.getItem(draftKey) ?? "{}");
    return { answers: stored.answers ?? {}, contact: stored.contact ?? "" };
  } catch {
    return { answers: {}, contact: "" };
  }
}

function saveDraft(draft: { answers: ScenarioAnswers; contact: string } | null) {
  try {
    if (draft) window.localStorage.setItem(draftKey, JSON.stringify(draft));
    else window.localStorage.removeItem(draftKey);
  } catch {
    // Storage refused: the answers still stay while the page is open.
  }
}

const questionCount = scenarioSteps.reduce((sum, step) => sum + step.questions.length, 0);
const fieldClass = "w-full rounded-control border border-line bg-surface p-3 text-base";

export function TesterScenarioScreen() {
  const [{ answers, contact }, setDraft] = useState(loadDraft);
  const [state, setState] = useState<SendState>("idle");

  useEffect(() => {
    if (state !== "sent") saveDraft({ answers, contact });
  }, [answers, contact, state]);

  const answered = Object.values(answers).filter((value) => value.trim() !== "").length;
  const setAnswer = (id: string, value: string) => setDraft((draft) => ({ ...draft, answers: { ...draft.answers, [id]: value } }));

  async function send() {
    if (answered === 0 || state === "sending") return;
    setState("sending");
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: apiHeaders(),
        body: JSON.stringify({ kind: "tester", answers: reportAnswers(answers), contact: contact.trim() || undefined }),
      });
      if (response.ok) {
        saveDraft(null);
        setState("sent");
      } else setState(response.status === 429 ? "limit" : "error");
    } catch {
      setState("error");
    }
  }

  if (state === "sent") {
    return (
      <article className="max-w-2xl mx-auto card space-y-3">
        <h1>Díky, odpovědi dorazily</h1>
        <p>Autor si je přečte a projde.{contact.trim() ? " Až s nimi něco udělá, dá ti vědět e-mailem." : ""}</p>
      </article>
    );
  }

  return (
    <article className="max-w-2xl mx-auto space-y-6">
      <header className="space-y-4">
        <h1>Testovací scénář</h1>
        <p>
          Díky, že Role Lab vyzkoušíš. Zabere to asi 10 minut. Aplikaci měj otevřenou ve vedlejší kartě a tady
          odpovídej, odpovědi se mezitím pamatují. Každá otázka je nepovinná a odeslat můžeš kdykoli, i když neprojdeš
          všechno.
        </p>
        <a href="/" target="_blank" rel="noopener" className="inline-flex items-center gap-2 rounded-full bg-action text-action-contrast px-5 py-2.5 font-medium">
          Otevřít Role Lab v nové kartě <ExternalLink aria-hidden="true" size={16} />
        </a>
        <ul className="card list-disc pl-10 space-y-2 text-sm">
          <li>Co napíšeš asistentovi, jde k AI (Claude) přes server aplikace. Nepiš tam osobní ani citlivé firemní údaje.</li>
          <li>Hodnocení celého úkolu jde udělat dvakrát za den, výzev zvládneš patnáct.</li>
          <li>Odpovědi se odešlou tlačítkem dole do soukromého seznamu námětů autora.</li>
        </ul>
        <p className="text-sm text-ink-muted" aria-live="polite">
          Zodpovězeno {answered} z {questionCount}
        </p>
      </header>

      {scenarioSteps.map((step, index) => (
        <section key={step.title} className="card space-y-5" aria-labelledby={`step-${index}`}>
          <div className="flex items-baseline justify-between gap-3">
            <h2 id={`step-${index}`}>
              {index + 1}. {step.title}
            </h2>
            <span className="text-sm text-ink-muted whitespace-nowrap">{step.minutes}</span>
          </div>
          <p className="rounded-control bg-paper p-3">{step.todo}</p>
          {step.questions.map((question) => (
            <Question key={question.id} question={question} value={answers[question.id] ?? ""} onChange={(value) => setAnswer(question.id, value)} />
          ))}
        </section>
      ))}

      <section className="card space-y-4" aria-labelledby="send-heading">
        <h2 id="send-heading">Odeslat odpovědi</h2>
        <label className="block">
          <span className="block font-medium mb-1">E-mail (nepovinné)</span>
          <span className="block text-sm text-ink-muted mb-2">
            Chceš vědět, co se z tvých připomínek udělalo? Nech e-mail. Použije se jen k odpovědi autora.
          </span>
          <input
            type="email"
            value={contact}
            onChange={(event) => setDraft((draft) => ({ ...draft, contact: event.target.value }))}
            maxLength={200}
            autoComplete="email"
            className={fieldClass}
          />
        </label>
        {state === "limit" && (
          <p role="alert" className="bg-notice text-notice-ink rounded-control p-3">Dnešní limit zpráv je vyčerpaný. Zkus to prosím zítra, odpovědi tu zůstanou.</p>
        )}
        {state === "error" && (
          <p role="alert" className="bg-notice text-notice-ink rounded-control p-3">Odeslání se nepovedlo. Zkus to prosím znovu, odpovědi tu zůstanou.</p>
        )}
        <button
          type="button"
          onClick={send}
          disabled={answered === 0 || state === "sending"}
          className="rounded-full bg-action text-action-contrast px-5 py-2.5 font-medium disabled:opacity-50"
        >
          {state === "sending" ? "Odesílám…" : "Odeslat odpovědi"}
        </button>
      </section>
    </article>
  );
}

function Question({ question, value, onChange }: { question: ScenarioQuestion; value: string; onChange: (value: string) => void }) {
  if (question.type === "text" || question.type === "line") {
    return (
      <label className="block">
        <span className="block font-medium mb-1">{question.text}</span>
        {question.type === "text" ? (
          <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={3} maxLength={2000} className={fieldClass} />
        ) : (
          <input value={value} onChange={(event) => onChange(event.target.value)} maxLength={300} className={fieldClass} />
        )}
      </label>
    );
  }
  const options =
    question.type === "choice" ? question.options : Array.from({ length: question.type === "nps" ? 11 : 5 }, (_, index) => String(question.type === "nps" ? index : index + 1));
  return (
    <fieldset>
      <legend className="font-medium mb-2">{question.text}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => (
          <label key={option} className="cursor-pointer">
            <input type="radio" name={question.id} value={option} checked={value === option} onChange={() => onChange(option)} className="peer sr-only" />
            <span className="grid place-items-center min-w-10 h-10 px-3 rounded-full border border-line peer-checked:bg-action peer-checked:text-action-contrast peer-checked:border-transparent peer-focus-visible:outline-2 peer-focus-visible:outline-accent">
              {option}
            </span>
          </label>
        ))}
      </div>
      {"ends" in question && (
        <p className="flex justify-between text-xs text-ink-muted mt-1.5 max-w-md">
          <span>{question.ends[0]}</span>
          <span>{question.ends[1]}</span>
        </p>
      )}
    </fieldset>
  );
}
