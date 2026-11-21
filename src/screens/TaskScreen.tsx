import { useState, type ReactNode } from "react";
import { revealChatEnd } from "../assistant/revealChatEnd";
import type { RoleConfig } from "../roles/roleSchema";
import { BriefPanel } from "../task/BriefPanel";
import { MaterialsPanel } from "../task/MaterialsPanel";
import { useIsWideScreen } from "../task/useIsWideScreen";
import { charLimitFromDeliverable, SubmissionPanel } from "../task/SubmissionPanel";
import { SoftTimer } from "../task/SoftTimer";
import { RestartButton } from "../task/RestartButton";
import { useTaskSession } from "../session/useTaskSession";
import { AssistantPanel } from "../assistant/AssistantPanel";
import type { AiAvailability } from "../runtime/useAiAvailability";
import type { AiBackend } from "../ai/aiBackend";
import { withSubmission } from "../session/useTaskSession";
import { useEvaluation } from "../evaluation/useEvaluation";
import { EvaluationView } from "../evaluation/EvaluationView";
import { panelId, type TabId } from "../task/TabBar";
import { PhoneTaskLayout, WideTaskLayout } from "../task/TaskLayouts";
import { RoleBadge } from "../components/RoleBadge";
import { NextStepButton, StepGuide } from "../task/StepGuide";
import { stepStates, taskProgress } from "../task/taskProgress";
import { track } from "../ai/track";
import { isCustomTask } from "../customTask/customTaskRole";

type TaskScreenProps = {
  role: RoleConfig;
  // Where the role's badge sits in the colour sweep, the same as on the home page.
  roleSweepPosition: number;
  aiStatus: AiAvailability;
  backend: AiBackend | null;
};

export function TaskScreen({ role, roleSweepPosition, aiStatus, backend }: TaskScreenProps) {
  const isWide = useIsWideScreen();
  // On a phone all four panels are tabs. On a wide screen only brief and
  // materials share the left column; assistant and submission are always visible.
  const [activeTab, setActiveTab] = useState<TabId>("brief");
  const leftTab: TabId = activeTab === "materials" ? "materials" : "brief";

  // Which side the newly shown tab slides in from on a phone (phoneLayout.css).
  const [slideFrom, setSlideFrom] = useState<"left" | "right" | null>(null);

  function selectTab(tab: TabId) {
    const order: TabId[] = ["brief", "materials", "assistant", "submit"];
    if (tab !== activeTab) setSlideFrom(order.indexOf(tab) > order.indexOf(activeTab) ? "right" : "left");
    setActiveTab(tab);
    // On a phone start from the top, so nothing hides under the claude.ai header, then scroll
    // only as far as needed to show the newest message above the message field.
    if (!isWide && tab === "assistant") {
      window.scrollTo({ top: 0 });
      requestAnimationFrame(() => {
        const messageList = document.querySelector<HTMLElement>(`#${panelId("assistant")} .rl-chat-messages`);
        if (messageList) revealChatEnd(messageList);
      });
    }
  }
  const controls = useTaskSession(role);
  const evaluation = useEvaluation(role, controls, backend);
  // Materials attached but not sent yet. Kept in memory only: after a reload they are simply attached again.
  const [pendingAttachmentIds, setPendingAttachmentIds] = useState<string[]>([]);

  function attachMaterial(materialId: string) {
    setPendingAttachmentIds((current) => (current.includes(materialId) ? current : [...current, materialId]));
    // On a phone the chat is a different tab; show it so the attachment is visible.
    if (!isWide) selectTab("assistant");
  }

  function goToSubmission() {
    setActiveTab("submit");
    // Focusing the field also scrolls it into view on a wide screen, where it sits below.
    requestAnimationFrame(() => document.getElementById("submission")?.focus());
  }

  // Takes the person to a step from the guide or a "next step" button. On a phone every
  // step is a tab; on a wide screen the assistant and the submission are always on screen,
  // so the button moves the focus there instead.
  function goToStep(tab: TabId) {
    if (!isWide) {
      selectTab(tab);
      if (tab !== "assistant") window.scrollTo({ top: 0 });
      return;
    }
    if (tab === "brief" || tab === "materials") {
      setActiveTab(tab);
      return;
    }
    if (tab === "assistant") {
      document.getElementById("chat-input")?.focus();
      return;
    }
    goToSubmission();
  }

  function submit() {
    // The evaluator gets exactly the state that is being stored (state updates are async).
    const submitted = withSubmission(controls.session);
    controls.submit();
    track("task_submitted", role.id);
    if (aiStatus === "available") evaluation.evaluate(submitted);
  }

  function restart() {
    evaluation.cancel();
    controls.restart();
    setPendingAttachmentIds([]);
  }

  const steps = stepStates(taskProgress(controls.session));

  const panels: Record<TabId, ReactNode> = {
    brief: (
      <>
        <StepGuide states={steps} isWide={isWide} />
        <BriefPanel role={role} />
        <NextStepButton label="Prohlédnout podklady" onClick={() => goToStep("materials")} />
      </>
    ),
    materials: (
      <>
        <MaterialsPanel
          // A restart gives a new startedAt; remounting lets material views be logged again.
          key={controls.session.startedAt}
          materials={role.materials}
          onViewed={controls.markMaterialViewed}
          onDownloaded={controls.markMaterialDownloaded}
          onAttach={attachMaterial}
          pendingAttachmentIds={pendingAttachmentIds}
        />
        <NextStepButton label="Pracovat s asistentem" onClick={() => goToStep("assistant")} />
      </>
    ),
    assistant: (
      <AssistantPanel
        // Remount after a restart so no notice or partial state survives into the new attempt.
        key={controls.session.startedAt}
        role={role}
        controls={controls}
        aiStatus={aiStatus}
        backend={backend}
        pendingAttachmentIds={pendingAttachmentIds}
        onRemoveAttachment={(materialId) =>
          setPendingAttachmentIds((current) => current.filter((id) => id !== materialId))
        }
        onAttachmentsSent={() => setPendingAttachmentIds([])}
        onGoToSubmission={goToSubmission}
      />
    ),
    submit: <SubmissionPanel controls={controls} charLimit={charLimitFromDeliverable(role.brief.deliverable)} onSubmit={submit} />,
  };

  return (
    <section>
      <div className="flex items-start gap-4 mb-4">
        <RoleBadge title={role.title} sweepPosition={roleSweepPosition} size="lg" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-accent">{role.title}</p>
          <h1 className="mb-1">{role.taskTitle}</h1>
          <p className="text-ink-muted">
            {role.context}
            {isCustomTask(role) && <span className="ml-2 rounded-full bg-paper px-2 py-0.5 text-sm">beta · nekalibrováno</span>}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 mb-8">
        {!controls.session.submittedAt && (
          <SoftTimer startedAt={controls.session.startedAt} limitMinutes={role.timeLimitMinutes} />
        )}
        <RestartButton onConfirm={restart} />
      </div>

      {controls.session.submittedAt ? (
        // Submitted work is locked; only "Začít znovu" starts a new attempt.
        <EvaluationView
          role={role}
          session={controls.session}
          run={evaluation.run}
          aiStatus={aiStatus}
          onEvaluate={() => evaluation.evaluate(controls.session)}
          onCancel={evaluation.cancel}
          onReviewChange={controls.saveReview}
          why={
            // "Proč tohle skóre?" knows only the fixed tasks (server/whyHandler.ts).
            backend && aiStatus === "available" && !isCustomTask(role)
              ? {
                  answers: controls.session.whyAnswers ?? {},
                  async ask(dimensionId) {
                    const outcome = await backend.explainScore(role, controls.session, dimensionId, new AbortController().signal);
                    if (outcome.kind === "ok") controls.saveWhy(dimensionId, outcome.why);
                    return outcome;
                  },
                }
              : undefined
          }
        />
      ) : isWide ? (
        <WideTaskLayout panels={panels} leftTab={leftTab} onSelect={selectTab} />
      ) : (
        <PhoneTaskLayout panels={panels} activeTab={activeTab} onSelect={selectTab} steps={steps} slideFrom={slideFrom} />
      )}
    </section>
  );
}
