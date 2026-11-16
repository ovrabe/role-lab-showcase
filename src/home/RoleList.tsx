import type { RoleConfig } from "../roles/roleSchema";
import type { RoleGroup } from "../roles/roleGroups";
import { RoleBadge, sweepPositionFor } from "../components/RoleBadge";
import { ClockIcon, StatusChip } from "../components/TaskChips";
import { loadSession } from "../session/sessionStorage";
import { roleStatus, taskProgress, type RoleStatus } from "../task/taskProgress";

type RoleListProps = { groups: RoleGroup[]; onSelectRole: (roleId: string) => void };

// The roles on the home page, short enough that the list starts on the first screen.
// Phone: one panel of rows, each with a one-line description. Computer: a separate card per
// role in three columns, with up to two lines of description, so it is clear what each role
// is. Two lists, each shown on its own screen size, because the layouts differ in more than spacing.
export function RoleList({ groups, onSelectRole }: RoleListProps) {
  const items = groups.map(({ role, tasks }, index) => ({
    role,
    tasks,
    status: combinedStatus(tasks),
    sweepPosition: sweepPositionFor(index, groups.length),
  }));

  return (
    <>
      <ul className="sm:hidden soft-card overflow-hidden mb-10 divide-y divide-line">
        {items.map(({ role, tasks, status, sweepPosition }) => (
          <li key={role.roleId}>
            <button type="button" onClick={() => onSelectRole(role.roleId)} className="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-paper">
              <RoleBadge title={role.title} sweepPosition={sweepPosition} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold leading-snug">{role.title}</span>
                <span className="block text-sm text-ink-muted truncate">{role.context}</span>
              </span>
              {status === "new" ? (
                <span className="text-xs text-ink-muted text-right whitespace-nowrap tabular-nums">
                  <span className="block">{taskCountLabel(tasks.length)}</span>
                  <span className="block">{durationLabel(tasks)}</span>
                </span>
              ) : (
                <StatusChip status={status} />
              )}
            </button>
          </li>
        ))}
      </ul>

      <ul className="hidden sm:grid grid-cols-3 gap-3 mb-10">
        {items.map(({ role, tasks, status, sweepPosition }) => (
          <li key={role.roleId} className="min-w-0">
            <button
              type="button"
              onClick={() => onSelectRole(role.roleId)}
              className="soft-card w-full h-full text-left flex items-start gap-3 p-4 transition-transform hover:-translate-y-0.5"
            >
              <RoleBadge title={role.title} sweepPosition={sweepPosition} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold leading-snug">{role.title}</span>
                <span className="text-sm text-ink-muted mt-1 line-clamp-2">{role.context}</span>
                <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-ink-muted tabular-nums">
                  <span className="inline-flex items-center gap-1.5">
                    <ClockIcon />
                    {taskCountLabel(tasks.length)} · {durationLabel(tasks)}
                  </span>
                  {status !== "new" && <StatusChip status={status} />}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

// Czech plural: 1 úkol, 2–4 úkoly, 5 and more úkolů.
export function taskCountLabel(count: number): string {
  if (count === 1) return "1 úkol";
  return count >= 2 && count <= 4 ? `${count} úkoly` : `${count} úkolů`;
}

// How long the role's tasks take, from their time limits: "15 min" or "15–45 min".
export function durationLabel(tasks: RoleConfig[]): string {
  const minutes = tasks.map((task) => task.timeLimitMinutes);
  const shortest = Math.min(...minutes);
  const longest = Math.max(...minutes);
  return shortest === longest ? `${shortest} min` : `${shortest}–${longest} min`;
}

// Unfinished work wins: one started task is enough to show "Rozpracováno" on the role.
function combinedStatus(tasks: RoleConfig[]): RoleStatus {
  const statuses = tasks.map((task) => roleStatus(taskProgress(loadSession(task.id))));
  if (statuses.includes("inProgress")) return "inProgress";
  return statuses.includes("submitted") ? "submitted" : "new";
}
