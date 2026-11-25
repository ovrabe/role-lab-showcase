import { useState, type FocusEvent } from "react";
import type { TaskSessionControls } from "../session/useTaskSession";

// The upper limit for every task (docs/SPEC.md, section 4). Going over is allowed while
// writing, so a pasted draft is never cut off; only submitting is blocked.
export const submissionCharLimit = 2500;

/**
 * The limit the task's brief states ("nejvýš 800 znaků"), so the counter agrees with the brief.
 * Every task states one (src/task/charLimit.test.ts); without it the general limit applies.
 */
export function charLimitFromDeliverable(deliverable: string): number {
  // The number starts with a digit, so a long run of spaces cannot be split many ways.
  const match = deliverable.match(/nejvýš\s+(\d[\d\s]*?)\s*znaků/i);
  const stated = match ? Number(match[1].replace(/\s/g, "")) : NaN;
  return Number.isFinite(stated) && stated > 0 ? Math.min(stated, submissionCharLimit) : submissionCharLimit;
}

const formatNumber = (value: number) => value.toLocaleString("cs-CZ");

// On a phone the keyboard covers the lower half of the screen and the phone scrolls only far
// enough to show the caret. Once the keyboard is up, move the whole field to the top (its label
// stays in view through scroll-margin in phoneLayout.css), so there is room to write.
function bringFieldToTop(event: FocusEvent<HTMLTextAreaElement>) {
  if (!window.matchMedia("(max-width: 1023px)").matches) return;
  const field = event.currentTarget;
  window.setTimeout(() => field.scrollIntoView({ block: "start" }), 300);
}

type SubmissionPanelProps = { controls: TaskSessionControls; charLimit: number; onSubmit: () => void };

export function SubmissionPanel({ controls, charLimit, onSubmit }: SubmissionPanelProps) {
  const { session } = controls;
  const length = session.submission.length;
  const overLimit = length - charLimit;

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <label htmlFor="submission" className="block font-semibold mb-1">
          {/* Generic on purpose: what exactly is handed in is described in each role's brief. */}
          Tvůj výsledek
        </label>
        <textarea
          id="submission"
          value={session.submission}
          onChange={(event) => controls.setSubmission(event.target.value)}
          onFocus={bringFieldToTop}
          onBlur={controls.commitSubmission}
          rows={10}
          aria-describedby="submission-counter"
          className="rl-submission-field w-full rounded-control border border-line bg-surface p-3 text-base"
        />
        {/* The bar fills towards the limit; over the limit it stays full and the text says
            by how much. Blue, never red: going over is fixed by editing, not a failure. */}
        <div className="mt-2 h-1.5 rounded-full bg-line overflow-hidden" aria-hidden="true">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-300"
            style={{ width: `${Math.min(100, (length / charLimit) * 100)}%` }}
          />
        </div>
        <p id="submission-counter" aria-live="polite" className="text-sm mt-1.5 tabular-nums">
          {overLimit > 0 ? (
            <span className="font-semibold text-accent">
              {formatNumber(length)} / {formatNumber(charLimit)} znaků, o {formatNumber(overLimit)} víc,
              než je limit ze zadání. Před odevzdáním text zkrať.
            </span>
          ) : (
            <span className="text-ink-muted">
              {formatNumber(length)} / {formatNumber(charLimit)} znaků
            </span>
          )}
        </p>
      </div>

      <div>
        <label htmlFor="reflection" className="block font-semibold mb-1">
          Komentář k postupu <span className="font-normal text-ink-muted">(nepovinné)</span>
        </label>
        <textarea
          id="reflection"
          value={session.reflection}
          onChange={(event) => controls.setReflection(event.target.value)}
          onFocus={bringFieldToTop}
          rows={3}
          className="rl-submission-field w-full rounded-control border border-line bg-surface p-3 text-base"
        />
      </div>

      {!controls.isStored && (
        <p role="alert" className="bg-notice text-notice-ink rounded-control p-3">
          Prohlížeč nedovolil průběh uložit. Můžeš pracovat dál, ale po obnovení stránky se text ztratí. Pro jistotu si
          ho průběžně kopíruj jinam.
        </p>
      )}

      <SubmitControl
        blockedReason={
          session.submission.trim() === ""
            ? "Napiš svůj výsledek, pak ho můžeš odevzdat."
            : overLimit > 0
              ? "Text je delší než limit ze zadání. Zkrať ho, pak ho můžeš odevzdat."
              : null
        }
        onSubmit={onSubmit}
      />
    </div>
  );
}

function SubmitControl({ blockedReason, onSubmit }: { blockedReason: string | null; onSubmit: () => void }) {
  const [isConfirming, setIsConfirming] = useState(false);

  if (isConfirming && !blockedReason) {
    return (
      <div role="alertdialog" aria-label="Odevzdat výsledek" className="rl-submit-bar pt-2 space-y-3">
        <p>Po odevzdání už text nepůjde upravit. Pak se spustí hodnocení, které obvykle trvá do minuty. Odevzdat?</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setIsConfirming(false);
              onSubmit();
            }}
            className="rl-submit-sweep rounded-full px-6 py-2.5 font-semibold"
          >
            Odevzdat a vyhodnotit
          </button>
          <button type="button" autoFocus onClick={() => setIsConfirming(false)} className="rounded-full border border-line px-5 py-2">
            Ještě upravit
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rl-submit-bar pt-2">
      <button
        type="button"
        onClick={() => setIsConfirming(true)}
        disabled={blockedReason !== null}
        aria-describedby={blockedReason ? "submit-blocked-reason" : undefined}
        className="rl-submit-sweep rounded-full px-6 py-2.5 font-semibold disabled:opacity-50"
      >
        Odevzdat výsledek
      </button>
      {blockedReason && (
        <p id="submit-blocked-reason" className="text-ink-muted mt-2">
          {blockedReason}
        </p>
      )}
    </div>
  );
}
