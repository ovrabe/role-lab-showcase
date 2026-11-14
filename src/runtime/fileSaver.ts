import { isSimulation } from "./useAiAvailability";

// Offering a file to the viewer works differently per place the page runs:
// - inside claude.ai: only through the `downloads` capability (plain downloads are blocked),
// - outside claude.ai (npm run dev, a file opened by double-click): an ordinary browser download,
// - inside claude.ai without the capability: no download at all, the text is shown to copy.

export type SaveOutcome =
  | { kind: "saved" }
  | { kind: "declined" }
  | { kind: "fallback" } // show the content for manual copying
  | { kind: "error"; message: string };

type DownloadsApi = typeof Claude.downloads;

let downloadsPromise: Promise<DownloadsApi | null> | null = null;

// Resolved once per page; use() asks the viewer nothing, the confirmation comes with save().
function getDownloads(): Promise<DownloadsApi | null> {
  if (!downloadsPromise) {
    const claude = (window as { claude?: Claude }).claude;
    downloadsPromise = claude ? claude.use("downloads").catch(() => null) : Promise.resolve(null);
  }
  return downloadsPromise;
}

function browserDownload(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

const mimeByExtension: Record<string, string> = { csv: "text/csv", json: "application/json", md: "text/markdown" };

export async function saveTextFile(filename: string, content: string): Promise<SaveOutcome> {
  const extension = filename.split(".").pop() ?? "";
  // The byte order mark makes Excel read Czech characters in CSV correctly.
  const data = extension === "csv" ? "﻿" + content : content;
  const isInsideClaude = (window as { claude?: Claude }).claude !== undefined;

  // Development only: behave like the capability, so the flow can be tried without claude.ai.
  // window.mockNextSave = "declined" | "fallback" in the console tries the other outcomes.
  if (import.meta.env.DEV && isSimulation) {
    const devWindow = window as { lastSavedFile?: { filename: string; data: string }; mockNextSave?: string };
    const forced = devWindow.mockNextSave;
    devWindow.mockNextSave = undefined;
    if (forced === "declined") return { kind: "declined" };
    if (forced === "fallback") return { kind: "fallback" };
    devWindow.lastSavedFile = { filename, data };
    return { kind: "saved" };
  }

  if (!isInsideClaude) {
    browserDownload(filename, data, mimeByExtension[extension] ?? "text/plain");
    return { kind: "saved" };
  }

  const downloads = await getDownloads();
  if (!downloads) return { kind: "fallback" };
  try {
    await downloads.save({ filename, data });
    return { kind: "saved" };
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "unavailable";
    if (code === "declined") return { kind: "declined" };
    if (code === "rate_limited") {
      return { kind: "error", message: "Jedno stahování už čeká na potvrzení. Dokonči ho, pak to zkus znovu." };
    }
    if (code === "bad_request" || code === "rejected_extension" || code === "transform_error") {
      console.error("downloads.save() rejected because of the page:", error);
    }
    // unavailable, not_granted and the rest: saving is not possible here, offer the text instead.
    return { kind: "fallback" };
  }
}
