import { composeTask, RoleDefinition, TaskDefinition, type RoleConfig } from "./roleSchema.js";

// Text of a material file by its path, e.g. "data/category-manager/x.csv". The page reads
// files inlined by Vite, the web server reads them from disk; both feed the same parsing.
export type MaterialTextLookup = (file: string) => string | undefined;

// Role configs that are switched on. Adding a role = add its JSON to data/roles/, at least
// one task to data/tasks/ and its id here. Configs present but not listed show as upcoming.
const activeRoleIds = [
  "category-manager",
  "project-manager",
  "ai-tech-lead",
  "recruiter",
  "marketer",
  "it-helpdesk",
  "qa",
  "research-associate",
];

// Roles shown on the intro screen as upcoming, with no config yet.
const plannedRoleTitles = ["Controller"];

export type RoleLoadError = { file: string; problems: string[] };

export type LoadedRoles = {
  // Every task of the active roles, each with its role's shared parts: by role, then by difficulty.
  activeRoles: RoleConfig[];
  upcomingRoleTitles: string[];
  errors: RoleLoadError[];
};

const relativePath = (path: string) => path.replace(/^(\.\.\/)+/, "");

function describeIssues(issues: { path: PropertyKey[]; message: string }[]): string[] {
  return issues.map((issue) => `${issue.path.map(String).join(".") || "(celý soubor)"}: ${issue.message}`);
}

/** Validates role and task configs and puts each task together with its role. No file access here. */
export function parseRoles(
  roleFiles: Record<string, unknown>,
  taskFiles: Record<string, unknown>,
  getMaterialText: MaterialTextLookup,
): LoadedRoles {
  const roles = new Map<string, RoleDefinition>();
  const errors: RoleLoadError[] = [];

  for (const [path, content] of Object.entries(roleFiles)) {
    const result = RoleDefinition.safeParse(content);
    if (result.success) roles.set(result.data.id, result.data);
    else errors.push({ file: relativePath(path), problems: describeIssues(result.error.issues) });
  }

  const tasks: RoleConfig[] = [];
  for (const [path, content] of Object.entries(taskFiles)) {
    const file = relativePath(path);
    const result = TaskDefinition.safeParse(content);
    if (!result.success) {
      errors.push({ file, problems: describeIssues(result.error.issues) });
      continue;
    }
    const role = roles.get(result.data.roleId);
    if (!role) {
      errors.push({ file, problems: [`roleId: role ${result.data.roleId} v data/roles/ neexistuje`] });
      continue;
    }
    const missingFiles = result.data.materials
      .filter((material) => getMaterialText(material.file) === undefined)
      .map((material) => `materials.${material.id}: soubor ${material.file} neexistuje`);
    if (missingFiles.length > 0) errors.push({ file, problems: missingFiles });
    else tasks.push(composeTask(role, result.data));
  }

  for (const roleId of activeRoleIds) {
    if (!tasks.some((task) => task.roleId === roleId)) {
      errors.push({
        file: `data/roles/${roleId}.json`,
        problems: ["Role je zapnutá, ale chybí její konfigurace nebo žádný platný úkol."],
      });
    }
  }

  // Keep the order of activeRoleIds so the intro screen is stable; easier tasks first.
  const activeRoles = tasks
    .filter((task) => activeRoleIds.includes(task.roleId))
    .sort((a, b) => activeRoleIds.indexOf(a.roleId) - activeRoleIds.indexOf(b.roleId) || a.difficulty - b.difficulty);

  const inactiveConfiguredTitles = [...roles.values()].filter((role) => !activeRoleIds.includes(role.id)).map((role) => role.title);

  return {
    activeRoles,
    upcomingRoleTitles: [...inactiveConfiguredTitles, ...plannedRoleTitles],
    errors,
  };
}
