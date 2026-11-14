import { getMaterialText } from "../materials/materialFiles";
import { parseRoles, type LoadedRoles } from "./parseRoles";

export type { LoadedRoles, RoleLoadError } from "./parseRoles";

// Vite inlines every matching JSON at build time, so the single-file page
// needs no network. Only public role configs match; evaluator keys live elsewhere.
const roleFiles = import.meta.glob("../../data/roles/*.json", { eager: true, import: "default" });

export function loadRoles(): LoadedRoles {
  return parseRoles(roleFiles, getMaterialText);
}
