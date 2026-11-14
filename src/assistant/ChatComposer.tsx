import type { MouseEvent } from "react";
import { ArrowUp, Paperclip, Square, X } from "lucide-react";
import type { Material } from "../roles/roleSchema";

type ChatComposerProps = {
  draft: string;
  onDraftChange: (text: string) => void;
  attachments: Material[];
  onRemoveAttachment: (materialId: string) => void;
  remainingMessages: number;
  maxMessages: number;
  isPending: boolean;
  isConnecting: boolean;
  onSend: () => void;
  onStop: () => void;
};

// Czech plural: 1 zpráva, 2–4 zprávy, 0 and 5+ zpráv.
function remainingLabel(remaining: number, max: number): string {
  if (remaining === 1) return `Zbývá 1 zpráva z ${max}`;
  if (remaining >= 2 && remaining <= 4) return `Zbývají ${remaining} zprávy z ${max}`;
  return `Zbývá ${remaining} zpráv z ${max}`;
}

export function ChatComposer(props: ChatComposerProps) {
  const { draft, attachments, isPending, isConnecting } = props;
  const canSend = !isConnecting && (draft.trim() !== "" || attachments.length > 0);
  // Pressing a button would take the focus from the message field. On a phone that closes the
  // keyboard and brings back the bottom bar mid-tap, so the layout jumps and the tap can miss.
  const keepFocusInField = (event: MouseEvent) => event.preventDefault();

  return (
    <form
      className="mt-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (canSend) props.onSend();
      }}
    >
      {attachments.length > 0 && (
        <ul aria-label="Přiložené podklady" className="flex flex-wrap gap-2 mb-2">
          {attachments.map((material) => (
            <li key={material.id} className="flex items-center gap-1.5 rounded-full bg-paper pl-3 text-sm">
              <Paperclip aria-hidden="true" size={14} className="text-ink-muted" />
              <span>{material.title}</span>
              <button
                type="button"
                onMouseDown={keepFocusInField}
                onClick={() => props.onRemoveAttachment(material.id)}
                aria-label={`Odebrat přílohu ${material.title}`}
                className="p-1.5 mr-0.5 rounded-full text-ink-muted hover:text-ink"
              >
                <X aria-hidden="true" size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* One rounded field with the send button inside, as in common chat apps. The border
          keeps the 3:1 contrast a text field needs; the focus ring goes around the whole field. */}
      <div
        className="flex gap-2 items-end rounded-card border bg-surface p-1.5 pl-4 focus-within:outline-2 focus-within:outline-accent focus-within:outline-offset-2"
        style={{ borderColor: "var(--color-control-border)" }}
      >
        <label htmlFor="chat-input" className="sr-only">
          Zpráva pro asistenta
        </label>
        <textarea
          id="chat-input"
          value={draft}
          onChange={(event) => props.onDraftChange(event.target.value)}
          onKeyDown={(event) => {
            // Enter sends, Shift+Enter makes a new line, like common chat apps.
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              if (canSend && !isPending) props.onSend();
            }
          }}
          rows={2}
          placeholder={isConnecting ? "Připojuji asistenta…" : "Napiš zprávu asistentovi"}
          className="rl-chat-input flex-1 min-w-0 border-0 bg-transparent py-1.5 text-base resize-none"
        />
        {isPending ? (
          <button
            type="button"
            onMouseDown={keepFocusInField}
            onClick={props.onStop}
            aria-label="Zastavit"
            className="shrink-0 grid place-items-center size-10 rounded-full bg-paper text-ink"
          >
            <Square aria-hidden="true" size={14} fill="currentColor" />
          </button>
        ) : (
          <button
            type="submit"
            onMouseDown={keepFocusInField}
            disabled={!canSend}
            aria-label="Odeslat"
            className="shrink-0 grid place-items-center size-10 rounded-full bg-action text-action-contrast disabled:opacity-40"
          >
            <ArrowUp aria-hidden="true" size={20} />
          </button>
        )}
      </div>
      <p className="text-sm text-ink-muted mt-1.5 pl-4 tabular-nums">
        {remainingLabel(props.remainingMessages, props.maxMessages)}
      </p>
    </form>
  );
}
