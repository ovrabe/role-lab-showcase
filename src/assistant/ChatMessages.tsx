import { useEffect, useRef } from "react";
import type { TranscriptItem } from "../session/sessionSchema";
import { Paperclip } from "lucide-react";
import { Markdown } from "../components/Markdown";
import { CopyButton } from "../components/CopyButton";
import { AiIcon } from "../components/AiIcon";
import { revealChatEnd } from "./revealChatEnd";

type ChatMessagesProps = {
  // User and assistant messages plus data_attached events.
  items: TranscriptItem[];
  // null = no answer in progress, "" = waiting for the first text.
  streamingText: string | null;
};

export function ChatMessages({ items, streamingText }: ChatMessagesProps) {
  const listRef = useRef<HTMLDivElement>(null);

  // Keep the newest text in view while the answer streams in. On a phone the messages flow
  // in the page (phoneLayout.css), so the page scrolls instead of the list; a hidden tab stays put.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    if (getComputedStyle(list).overflowY === "visible") {
      if (list.offsetParent !== null) revealChatEnd(list);
    } else {
      list.scrollTop = list.scrollHeight;
    }
  }, [items.length, streamingText]);

  return (
    <div
      ref={listRef}
      aria-live="polite"
      aria-busy={streamingText !== null}
      // Denser lines than the rest of the page: a chat is scanned, not read like a document.
      className="rl-chat-messages flex-1 overflow-y-auto space-y-4 pr-1 leading-normal"
    >
      {items.length === 0 && streamingText === null && (
        <p className="text-ink-muted">
          Asistent ti pomůže s analýzou, výpočty nebo textem. Podklady mu můžeš přiložit, nebo mu část vložit do zprávy.
        </p>
      )}

      {items.map((item) => (
        <ChatItem key={item.turn} item={item} />
      ))}

      {streamingText === "" && (
        <p className="rl-rise flex items-center gap-2 text-ink-muted">
          <AiIcon /> Přemýšlím
          <span className="rl-dots" aria-hidden="true">
            <span>.</span>
            <span>.</span>
            <span>.</span>
          </span>
        </p>
      )}
      {streamingText && <AssistantMessage content={streamingText} />}
    </div>
  );
}

// Chat as in ColorOS (docs/SPEC.md, section 9): the person's message in a light bubble on
// the right, the assistant's answer as plain text under its name, attachments as small pills.
function ChatItem({ item }: { item: TranscriptItem }) {
  if (item.event === "data_attached") {
    return (
      <p className="rl-rise ml-auto w-fit max-w-[85%] flex items-center gap-1.5 rounded-full bg-paper px-3 py-1 text-sm text-ink-muted">
        <Paperclip aria-hidden="true" size={14} />
        {item.content}
      </p>
    );
  }
  if (item.kind === "user") {
    // A message may carry only attachments; the attachment lines above already show it.
    if (item.content.trim() === "") return null;
    return (
      <div className="rl-rise ml-auto w-fit max-w-[85%] rounded-card rounded-br-md bg-paper px-4 py-2.5">
        <p className="sr-only">Ty:</p>
        <p className="whitespace-pre-wrap">{item.content}</p>
      </div>
    );
  }
  return <AssistantMessage content={item.content} canCopy />;
}

// No rise animation here: the answer already appears gradually as it streams, and the
// finished message replaces the streaming one, which would make it jump a second time.
function AssistantMessage({ content, canCopy = false }: { content: string; canCopy?: boolean }) {
  const textRef = useRef<HTMLDivElement>(null);
  return (
    <div>
      <p className="flex items-center gap-1.5 text-xs font-semibold text-ink-muted mb-1">
        <AiIcon size={14} />
        Asistent
      </p>
      <div ref={textRef}>
        <Markdown text={content} />
      </div>
      {/* Copies the answer as it reads on screen (no ** or | from Markdown), ready to paste
          into the plain submission field. Only finished answers, not one still streaming. */}
      {canCopy && (
        <div className="mt-1">
          <CopyButton label="Kopírovat" getText={() => textRef.current?.innerText.trim() ?? content} />
        </div>
      )}
    </div>
  );
}
