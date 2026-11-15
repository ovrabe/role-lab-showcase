import tourFile from "../../data/tutorial/tour.json";
import { parseTour } from "./tour";

// Bundled into the page like the role configs, checked once at start. The tour names its role
// in the file, so nothing here is tied to one role. If anything is broken, the tour screen
// says so instead of showing a half-working walkthrough.
const roleFiles = import.meta.glob("../../data/roles/*.json", { eager: true, import: "default" });
const tourRole = roleFiles[`../../data/roles/${tourFile.roleId}.json`];

export const tourResult = parseTour(tourFile, tourRole);
if (!tourResult.ok) console.error("Prohlídka je neplatná:", tourResult.problems);
