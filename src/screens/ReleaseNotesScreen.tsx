import { useEffect } from "react";
import changelog from "../../CHANGELOG.md?raw";
import { Markdown } from "../components/Markdown";
import { appVersion } from "../buildFlags";

// CHANGELOG.md is the one source of the release notes: the page shows it as it is, from the
// first version heading on. The file's own title and intro are replaced by the page's heading.
const firstVersionAt = changelog.indexOf("\n## ");
const releaseNotes = firstVersionAt === -1 ? changelog : changelog.slice(firstVersionAt + 1);

/** "Co je nového": the release notes, opened from the version in the footer. */
export function ReleaseNotesScreen() {
  // Opened from the footer, so the window is usually scrolled to the bottom of the last page.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);
  return (
    <article className="max-w-2xl mx-auto">
      <h1 className="mb-2">Co je nového</h1>
      <p className="mb-8 text-ink-muted">Právě používáš verzi {appVersion}.</p>
      <Markdown text={releaseNotes} />
    </article>
  );
}
