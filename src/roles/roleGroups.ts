import type { RoleConfig } from "./roleSchema";

export type RoleGroup = { role: RoleConfig; tasks: RoleConfig[] };

/** Tasks grouped by role, in the order they come (by role, easiest first). `role` is the first task, for the role's own fields. */
export function roleGroups(tasks: RoleConfig[]): RoleGroup[] {
  const groups: RoleGroup[] = [];
  for (const task of tasks) {
    const group = groups.find((candidate) => candidate.role.roleId === task.roleId);
    if (group) group.tasks.push(task);
    else groups.push({ role: task, tasks: [task] });
  }
  return groups;
}
