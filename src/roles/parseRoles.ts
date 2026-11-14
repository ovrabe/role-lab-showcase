import { RoleConfig } from "./roleSchema.js";

// Text of a material file by its path, e.g. "data/category-manager/x.csv". The page reads
// files inlined by Vite, the web server reads them from disk; both feed the same parsing.
export type MaterialTextLookup = (file: string) => string | undefined;

// Role configs that are switched on. Adding a role = add its JSON to
// data/roles/ and its id here. Configs present but not listed show as upcoming.
const activeRoleIds = ["category-manager", "project-manager"];

// Roles shown on the intro screen as upcoming, with no config yet.
const plannedRoleTitles = ["Recruiter", "Controller", "Marketér", "Vedoucí týmu"];

export type RoleLoadError = { file: string; problems: string[] };

export type LoadedRoles = {
  activeRoles: RoleConfig[];
  upcomingRoleTitles: string[];
  errors: RoleLoadError[];
};

/** Validates role configs and sorts them into active and upcoming. No file access here. */
export function parseRoles(roleFiles: Record<string, unknown>, getMaterialText: MaterialTextLookup): LoadedRoles {
  const validRoles: RoleConfig[] = [];
  const errors: RoleLoadError[] = [];

  for (const [path, content] of Object.entries(roleFiles)) {
    const file = path.replace(/^(\.\.\/)+/, "");
    const result = RoleConfig.safeParse(content);
    if (result.success) {
      const missingFiles = result.data.materials
        .filter((material) => getMaterialText(material.file) === undefined)
        .map((material) => `materials.${material.id}: soubor ${material.file} neexistuje`);
      if (missingFiles.length > 0) {
        errors.push({ file, problems: missingFiles });
      } else {
        validRoles.push(result.data);
      }
    } else {
      errors.push({
        file,
        problems: result.error.issues.map((issue) => `${issue.path.join(".") || "(celý soubor)"}: ${issue.message}`),
      });
    }
  }

  for (const roleId of activeRoleIds) {
    if (!validRoles.some((role) => role.id === roleId)) {
      errors.push({
        file: `data/roles/${roleId}.json`,
        problems: ["Role je zapnutá, ale její konfigurace chybí nebo je neplatná."],
      });
    }
  }

  // Keep the order of activeRoleIds so the intro screen is stable.
  const activeRoles = activeRoleIds
    .map((roleId) => validRoles.find((role) => role.id === roleId))
    .filter((role): role is RoleConfig => role !== undefined);

  const inactiveConfiguredTitles = validRoles
    .filter((role) => !activeRoleIds.includes(role.id))
    .map((role) => role.title);

  return {
    activeRoles,
    upcomingRoleTitles: [...inactiveConfiguredTitles, ...plannedRoleTitles],
    errors,
  };
}
