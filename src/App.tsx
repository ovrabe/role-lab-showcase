import { useEffect, useState } from "react";
import { PreviewPill } from "./components/PreviewPill";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AvatarMedal, useAvatar } from "./profile/AvatarMedal";
import { ThemeToggle } from "./components/ThemeToggle";
import { Footer } from "./components/Footer";
import { useAiAvailability } from "./runtime/useAiAvailability";
import { loadSession, saveLastRoleId } from "./session/sessionStorage";
import { roleStatus, taskProgress } from "./task/taskProgress";
import { initialScreen, ScreenContent } from "./AppScreens";
import { useScreenHistory } from "./useScreenHistory";

export default function App() {
  const { screen, open: setScreen, back, forward, canGoBack, canGoForward } = useScreenHistory(initialScreen);
  // A short note after leaving an unfinished task: the work is saved, not lost.
  const [showSavedNote, setShowSavedNote] = useState(false);

  useEffect(() => {
    if (!showSavedNote) return;
    const timeout = window.setTimeout(() => setShowSavedNote(false), 3000);
    return () => window.clearTimeout(timeout);
  }, [showSavedNote]);

  // Back to where the person came from; leaving an unfinished task says it stays saved.
  function goBack() {
    if (screen.name === "task" && roleStatus(taskProgress(loadSession(screen.roleId))) === "inProgress") setShowSavedNote(true);
    back();
  }
  const { status, backend, isSimulation } = useAiAvailability();
  const avatar = useAvatar();

  useEffect(() => {
    saveLastRoleId(screen.name === "task" ? screen.roleId : null);
  }, [screen]);

  return (
    <div className="min-h-screen flex flex-col">
      {/* import.meta.env.DEV lets the build drop this banner entirely. */}
      {import.meta.env.DEV && isSimulation && (
        <div role="status" className="bg-notice text-notice-ink border-b border-line px-4 py-2 text-sm">
          <strong className="font-semibold">Simulace AI, jen pro vývoj.</strong> Odpovědi nejsou od Clauda. Chybu
          vyvoláš zprávou s <code>#chyba:rate_limited</code> nebo <code>#chyba-po:upstream_error</code>.
        </div>
      )}

      <header className="relative z-30 border-b glass">
        {/* Three parts like a browser's toolbar: arrows on the left, the name in the middle,
            appearance and profile on the right. On a phone the middle part takes the space
            that is left, so the name never runs into the controls. */}
        <div className="mx-auto max-w-7xl px-4 py-3 grid grid-cols-[auto_1fr_auto] sm:grid-cols-[1fr_auto_1fr] items-center gap-3">
          {/* An arrow shows only when there is somewhere to go, so the home page stays clean.
              The nav itself stays, so the name keeps its place in the middle. */}
          <nav aria-label="Historie" className="flex items-center gap-1 min-h-10">
            {canGoBack && (
              <HistoryButton label="Zpět" onClick={goBack}>
                <ChevronLeft aria-hidden="true" size={22} />
              </HistoryButton>
            )}
            {canGoForward && (
              <HistoryButton label="Vpřed" onClick={forward}>
                <ChevronRight aria-hidden="true" size={22} />
              </HistoryButton>
            )}
          </nav>
          <button
            type="button"
            onClick={() => setScreen({ name: "home" })}
            className="justify-self-center text-lg font-semibold text-ink whitespace-nowrap"
          >
            Role Lab
          </button>
          <div className="justify-self-end flex items-center gap-4 sm:gap-6">
            {status === "preview" && <PreviewPill />}
            {/* The theme switch only on the home page: it is a one-off setting, the default
                follows the system, and inside the task every row of the screen counts. */}
            {screen.name === "home" && <ThemeToggle />}
            {/* Profile in the header, as in phone apps; not inside a task, where the row is for leaving it.
                Just the avatar: the label appears on hover and is read out by screen readers. */}
            {screen.name !== "task" && (
              <button
                type="button"
                onClick={() => setScreen({ name: "profile" })}
                aria-current={screen.name === "profile" ? "page" : undefined}
                aria-label="Můj profil"
                title="Můj profil"
                className="group rounded-full"
              >
                <span className="block rounded-full ring-offset-2 ring-offset-[var(--color-paper)] group-hover:ring-2 group-hover:ring-line group-aria-[current=page]:ring-2 group-aria-[current=page]:ring-[var(--color-progress)]">
                  <AvatarMedal avatar={avatar} size={40} />
                </span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-8">
        <ScreenContent screen={screen} setScreen={setScreen} aiStatus={status} backend={backend} />
      </main>

      {/* Not in the task: on a phone its floating bar owns the bottom of the screen. */}
      {screen.name !== "task" && <Footer
          page={screen.name}
          onOpenReleaseNotes={() => setScreen({ name: "releaseNotes" })}
          onOpenMakingOf={() => setScreen({ name: "makingOf" })}
        />}

      {showSavedNote && (
        <p
          role="status"
          className="rl-rise fixed z-40 left-1/2 -translate-x-1/2 bottom-[calc(1.25rem+env(safe-area-inset-bottom))] glass border rounded-full px-5 py-2.5 text-sm font-medium shadow-[var(--shadow-floating)] whitespace-nowrap"
        >
          Rozpracovaný úkol zůstal uložený
        </p>
      )}

    </div>
  );
}

// A round arrow like a browser's.
function HistoryButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="grid place-items-center size-10 rounded-full text-ink hover:bg-surface"
    >
      {children}
    </button>
  );
}
