import { useEffect, useRef, useState } from "react";

type FeedbackDialogProps = { open: boolean; page: string; onClose: () => void };
type SendState = "idle" | "sending" | "sent" | "limit" | "error";

/**
 * A short note for the author (web version only, server/feedback.ts). A native <dialog>:
 * the browser keeps focus inside it and closes it with Esc.
 */
export function FeedbackDialog({ open, page, onClose }: FeedbackDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [state, setState] = useState<SendState>("idle");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  function close() {
    // After a sent note the form starts empty next time; an unsent draft stays.
    if (state === "sent") {
      setMessage("");
      setContact("");
    }
    setState("idle");
    onClose();
  }

  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (!message.trim() || state === "sending") return;
    setState("sending");
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message, contact: contact.trim() || undefined, page }),
      });
      setState(response.ok ? "sent" : response.status === 429 ? "limit" : "error");
    } catch {
      setState("error");
    }
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={close}
      aria-labelledby="feedback-title"
      className="card m-auto w-[min(32rem,calc(100vw-2rem))] text-base text-left text-ink backdrop:bg-black/40"
    >
      {state === "sent" ? (
        <div className="space-y-4">
          <h2 id="feedback-title">Díky, zpráva dorazila</h2>
          <p>Autor si ji přečte.{contact.trim() ? " Až se k námětu dostane, dá ti vědět, jak s ním naložil." : ""}</p>
          <button type="button" autoFocus onClick={close} className="rounded-full bg-action text-action-contrast px-5 py-2 font-semibold">
            Zavřít
          </button>
        </div>
      ) : (
        <form onSubmit={send} className="space-y-4">
          <h2 id="feedback-title">Zpětná vazba</h2>
          <p className="text-ink-muted">Co se líbilo, co nefungovalo, co by stálo za změnu? Zprávu si přečte autor.</p>
          <label className="block">
            <span className="block font-medium mb-1">Zpráva</span>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              maxLength={2000}
              rows={5}
              required
              autoFocus
              className="w-full rounded-control border border-line bg-surface p-3 text-base"
            />
          </label>
          <label className="block">
            <span className="block font-medium mb-1">E-mail (nepovinné)</span>
            <span className="block text-sm text-ink-muted mb-2">
              Chceš vědět, jak autor s námětem naložil? Nech e-mail. Použije se jen k odpovědi na tuhle zprávu.
            </span>
            <input
              type="email"
              value={contact}
              onChange={(event) => setContact(event.target.value)}
              maxLength={200}
              autoComplete="email"
              placeholder="jmeno@example.com"
              className="w-full rounded-control border border-line bg-surface p-3 text-base"
            />
          </label>
          <p className="text-sm text-ink-muted">Ukládá se jen to, co sem napíšeš, do soukromého seznamu námětů autora.</p>
          {state === "limit" && (
            <p role="alert" className="bg-notice text-notice-ink rounded-control p-3">
              Dnešní limit zpráv je vyčerpaný. Zkus to prosím zítra.
            </p>
          )}
          {state === "error" && (
            <p role="alert" className="bg-notice text-notice-ink rounded-control p-3">
              Zprávu se nepodařilo odeslat. Zkus to prosím znovu.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={!message.trim() || state === "sending"}
              className="rounded-full bg-action text-action-contrast px-5 py-2 font-semibold disabled:opacity-50"
            >
              {state === "sending" ? "Odesílám…" : "Odeslat"}
            </button>
            <button type="button" onClick={close} className="rounded-full border border-line px-5 py-2">
              Zrušit
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
}
