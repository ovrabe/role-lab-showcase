import { loadRoles } from "./loadRoles";

// Saved attempts and sessions name the task in a field still called "roleId" (from the time
// when each role had one task, whose id is the role's id). Where the role itself matters,
// such as "in both roles", this maps a task to its role. An unknown id stays as it is.
const roleByTask = new Map(loadRoles().activeRoles.map((task) => [task.id, task.roleId]));

export function roleOfTask(taskId: string): string {
  return roleByTask.get(taskId) ?? taskId;
}
