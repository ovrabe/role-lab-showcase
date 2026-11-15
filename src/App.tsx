import { useEffect, useState } from "react";
import { PreviewPill } from "./components/PreviewPill";
import { ArrowLeft } from "lucide-react";
import { AvatarMedal, useAvatar } from "./profile/AvatarMedal";
import { ThemeToggle } from "./components/ThemeToggle";
import { Footer } from "./components/Footer";
import { useAiAvailability } from "./runtime/useAiAvailability";
import { loadSession, saveLastRoleId } from "./session/sessionStorage";
import { roleStatus, taskProgress } from "./task/taskProgress";
import { initialScreen, ScreenContent, type Screen } from "./AppScreens";
import { roleOfTask } from "./roles/taskRoles";

export default function App() {
  const [screen, setScreen] = useState<Screen>(initialScreen);
  // A short note after leaving an unfinished task: the work is saved, not lost.
  const [showSavedNote, setShowSavedNote] = useState(false);

  useEffect(() => {
    if (!showSavedNote) return;
    const timeout = window.setTimeout(() => setShowSavedNote(false), 3000);
    return () => window.clearTimeout(timeout);
  }, [showSavedNote]);

  // Back to the role's tasks, where the person picked this one.
  function leaveTask(taskId: string) {
    if (roleStatus(taskProgress(loadSession(taskId))) === "inProgress") setShowSavedNote(true);
    setScreen({ name: "role", roleId: roleOfTask(taskId) });
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
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center gap-3">
          {/* One top row per screen, as in phone apps: in the task the back button takes the
              place of the name, so no extra row sits between the header and the content. */}
          {screen.name === "task" ? (
            <button
              type="button"
              onClick={() => leaveTask(screen.roleId)}
              className="flex items-center gap-2 text-ink-muted hover:text-ink font-medium whitespace-nowrap shrink-0"
            >
              <span className="grid place-items-center size-9 rounded-full bg-surface text-ink shadow-[var(--shadow-card)]">
                <ArrowLeft aria-hidden="true" size={18} />
              </span>
              Výběr úkolu
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setScreen({ name: "home" })}
              className="text-lg font-semibold text-ink whitespace-nowrap shrink-0"
            >
              Role Lab
            </button>
          )}
          <div className="ml-auto flex items-center">{status === "preview" && <PreviewPill />}</div>
          {/* The theme switch only on the home page: it is a one-off setting, the default
              follows the system, and inside the task every row of the screen counts. */}
          {screen.name === "home" && <ThemeToggle />}
          {/* Profile in the header, as in phone apps; not inside a task, where the row is for leaving it. */}
          {screen.name !== "task" && (
            <button
              type="button"
              onClick={() => setScreen({ name: "profile" })}
              aria-label="Můj profil"
              aria-current={screen.name === "profile" ? "page" : undefined}
              title="Můj profil"
              className="rounded-full ring-offset-2 ring-offset-[var(--color-paper)] hover:ring-2 hover:ring-line aria-[current=page]:ring-2 aria-[current=page]:ring-[var(--color-progress)]"
            >
              <AvatarMedal avatar={avatar} size={32} />
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-8">
        <ScreenContent screen={screen} setScreen={setScreen} aiStatus={status} backend={backend} />
      </main>

      {/* Not in the task: on a phone its floating bar owns the bottom of the screen. */}
      {screen.name !== "task" && <Footer page={screen.name} onOpenReleaseNotes={() => setScreen({ name: "releaseNotes" })} />}

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
