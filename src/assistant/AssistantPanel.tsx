import { useEffect, useRef, useState } from "react";
import type { RoleConfig } from "../roles/roleSchema";
import { withUserMessage, type TaskSessionControls } from "../session/useTaskSession";
import type { AiAvailability } from "../runtime/useAiAvailability";
import type { AiBackend } from "../ai/aiBackend";
import type { TranscriptItem } from "../session/sessionSchema";
import { buildAssistantTurns } from "../prompts/assistant";
import { getMaterialText } from "../materials/materialFiles";
import { fitTurnsToBudget } from "./promptBudget";
import { handleSampleError, partialTextOf } from "./sampleErrors";
import { ChatMessages } from "./ChatMessages";
import { ChatComposer } from "./ChatComposer";
import { maxUserMessages } from "./limits";


const previewReply =
  "V náhledu bez AI asistent neodpovídá. Otevři publikovanou stránku v claude.ai, tam odpovídá Claude.";
const stoppedNote = "\n\n_(Odpověď byla zastavena.)_";
const interruptedNote = "\n\n_(Odpověď se přerušila.)_";
const truncatedNote = "\n\n_(Odpověď byla zkrácena, protože byla příliš dlouhá.)_";
const tooLargeMessage =
  "Zpráva i s přiloženými podklady je na asistenta příliš dlouhá. Zkrať ji nebo přilož méně podkladů.";

type Notice = { message: string; offerRetry: boolean };

type AssistantPanelProps = {
  role: RoleConfig;
  controls: TaskSessionControls;
  aiStatus: AiAvailability;
  backend: AiBackend | null;
  pendingAttachmentIds: string[];
  onRemoveAttachment: (materialId: string) => void;
  onAttachmentsSent: () => void;
  onGoToSubmission: () => void;
};

export function AssistantPanel(props: AssistantPanelProps) {
  const { role, controls, aiStatus, backend, pendingAttachmentIds } = props;
  const [draft, setDraft] = useState("");
  // null = idle, "" = waiting for the first text ("Přemýšlím…"), otherwise the answer so far.
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const [droppedTurns, setDroppedTurns] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  // Leaving the task screen stops a running answer instead of letting it finish unseen.
  useEffect(() => () => abortRef.current?.abort(), []);

  const transcript = controls.session.transcript;
  const isPending = streamingText !== null;
  const chatItems = transcript.filter(
    (item) => item.kind === "user" || item.kind === "assistant" || item.event === "data_attached",
  );
  const userMessageCount = transcript.filter((item) => item.kind === "user").length;
  const remainingMessages = Math.max(0, maxUserMessages - userMessageCount);
  const attachments = pendingAttachmentIds
    .map((materialId) => role.materials.find((material) => material.id === materialId))
    .filter((material) => material !== undefined);

  // The backend builds the instructions from the role and the conversation (src/ai/aiBackend.ts).
  async function askClaude(conversation: TranscriptItem[]) {
    if (!backend) return;
    const controller = new AbortController(); // a new controller for every call
    abortRef.current = controller;
    setStreamingText("");
    setNotice(null);
    try {
      const result = await backend.chat(role, conversation, {
        signal: controller.signal,
        onText: (text) => setStreamingText(text),
      });
      controls.addAssistantMessage(result.truncated ? result.text + truncatedNote : result.text);
    } catch (error) {
      const handling = handleSampleError(error);
      const partial = partialTextOf(error);
      if (handling.keepPartial && partial.trim() !== "") {
        controls.addAssistantMessage(partial + (handling.kind === "silent" ? stoppedNote : interruptedNote));
      }
      if (handling.kind === "blocked") setIsBlocked(true);
      if (handling.kind !== "silent") setNotice({ message: handling.message, offerRetry: handling.offerRetry });
    } finally {
      abortRef.current = null;
      setStreamingText(null);
    }
  }

  // Checks the size before anything is recorded, so a message that cannot be sent leaves no trace.
  // Returns false when nothing was sent, so the draft and attachments stay for editing.
  function sendMessage(text: string, materialIds: string[]): boolean {
    if (isPending || remainingMessages === 0) return false;
    if (text === "" && materialIds.length === 0) return false;
    const updated = withUserMessage(controls.session, role, text, materialIds);
    const fitted = fitTurnsToBudget(buildAssistantTurns(role, updated.transcript, getMaterialText));
    if (!fitted) {
      setNotice({ message: tooLargeMessage, offerRetry: false });
      return false;
    }
    controls.addUserMessage(text, materialIds);
    if (aiStatus !== "available") {
      controls.addAssistantMessage(previewReply);
      return true;
    }
    setDroppedTurns(fitted.droppedTurns);
    void askClaude(updated.transcript);
    return true;
  }

  function send() {
    if (sendMessage(draft.trim(), pendingAttachmentIds)) {
      setDraft("");
      props.onAttachmentsSent();
    }
  }

  function retry() {
    const lastMessage = [...transcript].reverse().find((item) => item.kind === "user" || item.kind === "assistant");
    // Nothing of the answer was kept: ask again with the same conversation, no new message.
    if (lastMessage?.kind === "user") {
      if (fitTurnsToBudget(buildAssistantTurns(role, transcript, getMaterialText))) void askClaude(transcript);
      return;
    }
    // A partial answer was kept: repeat the last question as a new message, so the record shows it.
    const lastQuestionIndex = transcript.map((item) => item.kind).lastIndexOf("user");
    if (lastQuestionIndex < 0) return;
    const reattachedIds: string[] = [];
    for (let index = lastQuestionIndex - 1; index >= 0 && transcript[index].event === "data_attached"; index--) {
      reattachedIds.unshift(transcript[index].materialId ?? "");
    }
    sendMessage(transcript[lastQuestionIndex].content, transcript[lastQuestionIndex].content ? [] : reattachedIds);
  }

  const noticeBox = notice && (
    <div role="alert" className="bg-notice text-notice-ink rounded-control p-3 mt-3 flex flex-wrap gap-3 items-center">
      <span className="flex-1 min-w-48">{notice.message}</span>
      {notice.offerRetry && !isBlocked && (
        <button type="button" onClick={retry} className="rounded-full border border-current px-4 py-1">
          Zkusit znovu
        </button>
      )}
    </div>
  );

  return (
    // Wide screen: a fixed share of the window next to the brief, the messages scroll inside it.
    // Phone: the messages flow in the page and the message field sticks above the bottom bar
    // (phoneLayout.css), so the layout does not depend on how tall the claude.ai viewer is.
    <div className="rl-chat flex flex-col h-[calc(100dvh-5rem)] min-h-80 lg:h-[calc(100dvh-9rem)] lg:min-h-[28rem]">
      <ChatMessages items={chatItems} streamingText={streamingText} />
      <div className="rl-composer-bar">
      {droppedTurns > 0 && (
        <p className="text-sm text-ink-muted mt-2">
          Konverzace je dlouhá, nejstarší část se asistentovi už neposílá.
        </p>
      )}
      {noticeBox}

      {isBlocked ? null : remainingMessages === 0 && !isPending ? (
        <div className="mt-3 border-t border-line pt-3">
          <p className="mb-2">Všech {maxUserMessages} zpráv pro asistenta je vyčerpaných. Teď už jen dokonči a odevzdej svůj výsledek.</p>
          <button type="button" onClick={props.onGoToSubmission} className="rounded-full bg-action text-action-contrast px-5 py-2 font-medium">
            Přejít k odevzdání
          </button>
        </div>
      ) : (
        <ChatComposer
          draft={draft}
          onDraftChange={setDraft}
          attachments={attachments}
          onRemoveAttachment={props.onRemoveAttachment}
          remainingMessages={remainingMessages}
          maxMessages={maxUserMessages}
          isPending={isPending}
          isConnecting={aiStatus === "checking"}
          onSend={send}
          onStop={() => abortRef.current?.abort()}
        />
      )}
      </div>
    </div>
  );
}
