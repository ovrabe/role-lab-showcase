import type { RoleConfig } from "../roles/roleSchema";
import type { ReviewerReview, TaskSession } from "../session/sessionSchema";
import type { AiAvailability } from "../runtime/useAiAvailability";
import type { EvaluationRun } from "./useEvaluation";
import { ResultScreen } from "../result/ResultScreen";
import { SampleViewer } from "../result/SampleViewer";
import { isParticipantBuild } from "../buildFlags";
import { EvaluationProgress } from "./EvaluationProgress";
import type { WhyControls } from "../result/WhyScore";

type EvaluationViewProps = {
  role: RoleConfig;
  session: TaskSession;
  run: EvaluationRun;
  aiStatus: AiAvailability;
  onEvaluate: () => void;
  onCancel: () => void;
  onReviewChange: (review: ReviewerReview | null) => void;
  why?: WhyControls;
};

// Shown instead of the task once it is submitted: the states of the evaluation, then the result.
export function EvaluationView({ role, session, run, aiStatus, onEvaluate, onCancel, onReviewChange, why }: EvaluationViewProps) {
  if (session.evaluation) return <ResultScreen role={role} session={session} onReviewChange={onReviewChange} why={why} />;

  const actionButton = (label: string) => (
    <button type="button" onClick={onEvaluate} className="rounded-full bg-action text-action-contrast px-4 py-2 font-medium">
      {label}
    </button>
  );

  return (
    // Status messages stay narrow; the sample result in preview needs the full width for two columns.
    <section className={`space-y-4 ${aiStatus ==="available" ? "max-w-2xl" : ""}`}>
      <h2>Odevzdáno</h2>
      {aiStatus !== "available" && isParticipantBuild ? (
        // The participant build has no samples to show (src/buildFlags.ts).
        <p>Hodnocení běží jen ve stránce otevřené v claude.ai. Tady v náhledu tvoje práce ohodnocená nebude.</p>
      ) : !isParticipantBuild && aiStatus !== "available" ? (
        // Outside claude.ai no evaluator runs: a clearly labelled sample shows what an evaluation looks like.
        <SampleViewer
          role={role}
          intro={
            <p>
              V náhledu bez AI hodnocení neběží, tvoje práce proto ohodnocená nebude. Můžeš se podívat, jak hodnocení
              vypadá, na ukázce jiného, vymyšleného člověka.
            </p>
          }
        />
      ) : run.status === "running" ? (
        // Only the first line is a live region: the steps change every few seconds and a screen
        // reader would otherwise read each change aloud.
        <div className="card flex items-start gap-4">
          {/* A slowly turning ring in the data gradient while the evaluator works. */}
          <span aria-hidden="true" className="rl-spin shrink-0 size-12 rounded-full bg-[conic-gradient(from_0deg,transparent_0%,#8a5cf6_55%,#5b6cff_100%)] [mask:radial-gradient(farthest-side,transparent_calc(100%-5px),#000_calc(100%-4px))]" />
          <div className="space-y-3">
            <p role="status" className="font-semibold">Hodnotím. Obvykle to trvá do minuty.</p>
            <EvaluationProgress />
            {/* Closing or reloading the page drops the evaluation; on the web it still counts toward the daily limit. */}
            <p className="text-sm text-ink-muted">Stránku mezitím nezavírej ani neobnovuj, jinak se hodnocení ztratí.</p>
            <button type="button" onClick={onCancel} className="rounded-full border border-line px-4 py-2">
              Zrušit
            </button>
          </div>
        </div>
      ) : run.status === "failed" ? (
        <div role="alert" className="space-y-3">
          <p className="bg-notice text-notice-ink rounded-control p-3">{run.message}</p>
          {run.canRetry && actionButton("Zkusit znovu")}
        </div>
      ) : run.status === "cancelled" ? (
        <div className="space-y-3">
          <p>Hodnocení je zrušené. Odevzdaný text zůstává, hodnocení můžeš spustit znovu.</p>
          {actionButton("Vyhodnotit")}
        </div>
      ) : (
        // After a reload nothing runs by itself: calling Claude needs the person's action.
        <div className="space-y-3">
          <p>Hodnocení zatím neproběhlo nebo bylo přerušeno.</p>
          {actionButton("Vyhodnotit")}
        </div>
      )}
    </section>
  );
}
