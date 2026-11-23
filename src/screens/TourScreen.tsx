import { useEffect, useRef, useState } from "react";
import { RotateCcw, Send } from "lucide-react";
import { track } from "../ai/track";
import { BriefPanel } from "../task/BriefPanel";
import { ChatMessages } from "../assistant/ChatMessages";
import { ResultScreen } from "../result/ResultScreen";
import { tourResult } from "../tutorial/loadTour";
import type { Tour } from "../tutorial/tour";
import { Coach, MaterialTable, NextButton } from "../tutorial/TourParts";

// A two-minute walkthrough of a task with a made-up example: the person clicks through
// prepared messages and sees scripted replies. Nothing here calls AI, saves anything or
// counts towards a limit.

const stageLabels = ["Zadání", "Rozhovor", "Odevzdání", "Hodnocení"];
type Stage = 0 | 1 | 2 | 3;

// Long enough to read as "the assistant is answering", short enough not to bore.
const thinkingMs = 900;

// Where the person got to, kept while the page is open: someone who goes from the end of the
// tour to the daily challenge and back lands where they left, not at the start again.
const remembered = { stage: 0 as Stage, sentCount: 0 };

type TourProps = {
  // Where to go after the tour: choosing a real task, or today's short challenge if there is one.
  onChooseTask: () => void;
  onTryChallenge?: () => void;
};

export function TourScreen(props: TourProps) {
  if (!tourResult.ok) {
    return <p className="max-w-2xl mx-auto">Prohlídku se teď nepodařilo načíst. Zkus to prosím později.</p>;
  }
  return <TourWalkthrough tour={tourResult.tour} {...props} />;
}

function TourWalkthrough({ tour, onChooseTask, onTryChallenge }: TourProps & { tour: Tour }) {
  const [stage, setStage] = useState<Stage>(remembered.stage);
  // How many prepared messages have been sent so far, and whether a reply is on its way.
  const [sentCount, setSentCount] = useState(remembered.sentCount);
  const [isThinking, setIsThinking] = useState(false);

  useEffect(() => {
    remembered.stage = stage;
    remembered.sentCount = sentCount;
  }, [stage, sentCount]);

  function restart() {
    setStage(0);
    setSentCount(0);
    setIsThinking(false);
  }

  useEffect(() => {
    if (!isThinking) return;
    const timeout = window.setTimeout(() => setIsThinking(false), thinkingMs);
    return () => window.clearTimeout(timeout);
  }, [isThinking]);

  // After each reply, bring the hint and the next message into view.
  const nextRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (sentCount > 0 && !isThinking) nextRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [sentCount, isThinking]);

  // A new stage starts at its top, as a new screen would.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [stage]);

  // The transcript has the opening event first, then user and assistant in turn.
  const shownItems = tour.session.transcript.slice(1, 1 + sentCount * 2 - (isThinking ? 1 : 0));
  const chatDone = sentCount === tour.steps.length && !isThinking;
  // Each hint goes with the message about to be sent: it says what to notice before sending it.
  const currentStep = tour.steps[Math.min(sentCount, tour.steps.length - 1)];
  const nextMessage = sentCount < tour.steps.length ? tour.steps[sentCount].user : null;

  function send() {
    setSentCount((count) => count + 1);
    setIsThinking(true);
  }

  return (
    // The result needs the full width for its two columns; the rest reads better narrow.
    <article className={`mx-auto space-y-6 ${stage === 3 ? "" : "max-w-3xl"}`}>
      <header className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-ink-muted">Prohlídka · {tour.title}</p>
          {(stage > 0 || sentCount > 0) && (
            <button type="button" onClick={restart} className="flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
              <RotateCcw aria-hidden="true" size={14} /> Začít znovu
            </button>
          )}
        </div>
        <ol aria-label="Kroky prohlídky" className="grid grid-cols-4 gap-2">
          {stageLabels.map((label, index) => (
            <li key={label} aria-current={index === stage ? "step" : undefined} className="space-y-1.5">
              <span
                aria-hidden="true"
                className={`block h-1.5 rounded-full ${index <= stage ? "bg-[image:var(--progress-sweep)]" : "bg-line"}`}
              />
              <span className={`block text-xs sm:text-sm ${index === stage ? "font-semibold text-ink" : "text-ink-muted"}`}>{label}</span>
            </li>
          ))}
        </ol>
      </header>

      {stage === 0 && (
        <>
          <Coach>{tour.coach.brief}</Coach>
          <BriefPanel role={tour.role} />
          <MaterialTable tour={tour} />
          <NextButton onClick={() => setStage(1)}>Začít rozhovor s asistentem</NextButton>
        </>
      )}

      {stage === 1 && (
        <>
          <section className="card">
            <ChatMessages items={shownItems} streamingText={isThinking ? "" : null} />
          </section>
          {/* The hint and the next message sit under the chat, where the eyes are after a reply. */}
          {!isThinking && (
            <div ref={nextRef} className="space-y-4 scroll-mb-6">
              <Coach>{currentStep.coach}</Coach>
              {nextMessage && (
                <div className="rounded-control border border-line bg-surface p-4 space-y-3">
                  <p className="text-xs font-semibold text-ink-muted">Připravená zpráva</p>
                  <p>{nextMessage}</p>
                  <button type="button" onClick={send} className="flex items-center gap-2 rounded-full bg-action text-action-contrast px-4 py-2 font-medium">
                    <Send aria-hidden="true" size={16} /> Odeslat
                  </button>
                </div>
              )}
              {chatDone && <NextButton onClick={() => setStage(2)}>Odevzdat výsledek</NextButton>}
            </div>
          )}
        </>
      )}

      {stage === 2 && (
        <>
          <Coach>{tour.coach.submission}</Coach>
          <section className="card space-y-2">
            <h2 className="text-base font-semibold">Tvůj výsledek</h2>
            <p className="whitespace-pre-wrap rounded-control border border-line bg-surface p-3">{tour.submission}</p>
          </section>
          <NextButton
            onClick={() => {
              setStage(3);
              // How many people get through the whole tour (anonymous count, src/ai/track.ts).
              track("tour_completed", "tour");
            }}
          >
            Odevzdat a ohodnotit
          </NextButton>
        </>
      )}

      {stage === 3 && (
        <>
          <Coach>{tour.coach.result}</Coach>
          {/* The real result screen. Without onReviewChange, score changes stay in memory only. */}
          <ResultScreen role={tour.role} session={tour.session} />
          <Coach>{tour.coach.resultMore}</Coach>
          <section className="card space-y-3 max-w-3xl">
            <h2>Teď to zkus naostro</h2>
            <p>Skutečný úkol trvá asi 15 minut a hodnotí ho AI. Denní výzva je kratší, asi na 5 minut.</p>
            <div className="flex flex-wrap gap-2">
              <NextButton onClick={onChooseTask}>Vybrat úkol</NextButton>
              {onTryChallenge && (
                <button type="button" onClick={onTryChallenge} className="rounded-full border border-line bg-surface px-5 py-2.5 font-medium">
                  Denní výzva
                </button>
              )}
            </div>
          </section>
        </>
      )}
    </article>
  );
}
