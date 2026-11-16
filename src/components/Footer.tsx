import { useState } from "react";
import { ArrowUpRight, MessageSquare } from "lucide-react";
import { appVersion, isWebBuild } from "../buildFlags";
import { FeedbackDialog } from "./FeedbackDialog";

// Author credit, in English on purpose (the author's choice). A visible LinkedIn link, so
// people looking at the project find the right person; no e-mail or phone, the page is public.
const linkedInUrl = "https://www.linkedin.com/in/ondrej-vrabel/";

const linkClass = "inline-flex items-center gap-1.5 hover:text-ink underline-offset-4 hover:underline";

type FooterProps = { page: string; onOpenReleaseNotes: () => void };

export function Footer({ page, onOpenReleaseNotes }: FooterProps) {
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  return (
    <footer className="mx-auto w-full max-w-7xl px-4 pb-8 pt-2 text-sm text-ink-muted">
      <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
        <span>Ondřej Vrabeľ</span>
        <span aria-hidden="true">·</span>
        <a href={linkedInUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>
          <LinkedInLogo />
          LinkedIn
          <ArrowUpRight aria-hidden="true" size={14} />
          <span className="sr-only">(otevře se v nové kartě)</span>
        </a>
        <span aria-hidden="true">·</span>
        <span>Built with Claude Code</span>
        <span aria-hidden="true">·</span>
        <button type="button" onClick={onOpenReleaseNotes} className={linkClass}>
          v{appVersion}
          <span className="sr-only">: co je nového</span>
        </button>
        {/* Feedback needs the project's server, which only the web version has. */}
        {isWebBuild && (
          <>
            <span aria-hidden="true">·</span>
            <button type="button" onClick={() => setIsFeedbackOpen(true)} className={linkClass}>
              <MessageSquare aria-hidden="true" size={14} />
              Napsat autorovi
            </button>
          </>
        )}
      </p>
      {isWebBuild && <FeedbackDialog open={isFeedbackOpen} page={page} onClose={() => setIsFeedbackOpen(false)} />}
    </footer>
  );
}

// LinkedIn's "in" mark, drawn inline so the page loads nothing from outside.
function LinkedInLogo() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
      <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13ZM7.12 20.45H3.56V9h3.56v11.45ZM22.23 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0h.01Z" />
    </svg>
  );
}
