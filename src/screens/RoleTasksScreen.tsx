import { useEffect } from "react";
import { Lock } from "lucide-react";
import type { RoleConfig } from "../roles/roleSchema";
import { RoleBadge } from "../components/RoleBadge";
import { ClockIcon, StatusChip } from "../components/TaskChips";
import { difficultyNames, taskLock } from "../roles/unlocking";
import { loadProgress } from "../progress/progressStorage";
import { loadSession } from "../session/sessionStorage";
import { roleStatus, taskProgress } from "../task/taskProgress";
import { isParticipantBuild } from "../buildFlags";

type RoleTasksScreenProps = {
  tasks: RoleConfig[];
  sweepPosition: number;
  onSelectTask: (taskId: string) => void;
};

// The first sentence of what to do: enough to tell the tasks apart at a glance.
const firstSentence = (text: string) => text.match(/^.*?[.!?](\s|$)/)?.[0].trim() ?? text;

/** The tasks of one role, easiest first, with what each needs to open (phase 3). */
export function RoleTasksScreen({ tasks, sweepPosition, onSelectTask }: RoleTasksScreenProps) {
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);
  const attempts = loadProgress().attempts;
  const role = tasks[0];
  if (!role) return null;

  return (
    <article className="max-w-2xl mx-auto space-y-6">
      <header className="flex items-start gap-4">
        <RoleBadge title={role.title} sweepPosition={sweepPosition} size="lg" />
        <div className="min-w-0">
          <h1>{role.title}</h1>
          <p className="text-ink-muted">{role.context}</p>
        </div>
      </header>

      <h2>Vyber si úkol</h2>
      <ul className="space-y-3">
        {tasks.map((task) => {
          const lock = taskLock(task, tasks, attempts);
          // The author's demo page opens everything, so new tasks can be tried before anyone unlocks them.
          const canOpen = lock.unlocked || !isParticipantBuild;
          const best = Math.max(0, ...attempts.filter((attempt) => attempt.roleId === task.id).map((attempt) => attempt.level));
          const bestLabel = task.levels.find((level) => level.level === best)?.label;
          return (
            <li key={task.id}>
              <button
                type="button"
                onClick={() => onSelectTask(task.id)}
                disabled={!canOpen}
                className="soft-card w-full text-left p-5 space-y-2 transition-transform enabled:hover:-translate-y-0.5 disabled:cursor-not-allowed"
              >
                <span className="flex items-center gap-2 text-sm font-semibold text-accent">
                  Obtížnost {task.difficulty} · {difficultyNames[task.difficulty]}
                  {!lock.unlocked && <Lock aria-label="zamčeno" size={14} className="text-ink-muted" />}
                </span>
                <span className={`block font-semibold text-lg ${lock.unlocked ? "" : "text-ink-muted"}`}>{task.taskTitle}</span>
                <span className="block text-ink-muted">{firstSentence(task.brief.task)}</span>
                {!lock.unlocked && (
                  <span className="block text-sm text-ink-muted">
                    {lock.reason}
                    {canOpen && " V ukázkové verzi jde otevřít i tak."}
                  </span>
                )}
                <span className="flex flex-wrap gap-2 pt-1">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-paper px-3 py-1 text-sm text-ink-muted">
                    <ClockIcon />
                    Asi {task.timeLimitMinutes} minut
                  </span>
                  <StatusChip status={roleStatus(taskProgress(loadSession(task.id)))} />
                  {bestLabel && (
                    <span className="rounded-full bg-paper px-3 py-1 text-sm font-semibold">Nejlépe: {bestLabel}</span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </article>
  );
}
