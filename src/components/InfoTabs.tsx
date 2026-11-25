// The two pages about the project as one section (web version): what Role Lab is and how it
// was built, and how the evaluation works. Same place and look on both, so they read as one.
export type InfoPage = "about" | "methodology";

const pages: { id: InfoPage; label: string }[] = [
  { id: "about", label: "O projektu" },
  { id: "methodology", label: "Jak hodnotíme" },
];

export function InfoTabs({ current, onSelect }: { current: InfoPage; onSelect: (page: InfoPage) => void }) {
  return (
    // The same look as the tabs inside a task (src/task/TabBar.tsx).
    <nav aria-label="O projektu" className="mb-8 inline-flex rounded-full bg-paper p-1">
      {pages.map((page) => (
        <button
          key={page.id}
          type="button"
          onClick={() => onSelect(page.id)}
          aria-current={page.id === current ? "page" : undefined}
          className="rounded-full px-4 sm:px-5 py-1.5 text-ink-muted whitespace-nowrap hover:text-ink aria-[current=page]:bg-surface aria-[current=page]:text-ink aria-[current=page]:font-semibold aria-[current=page]:shadow-[var(--shadow-card)]"
        >
          {page.label}
        </button>
      ))}
    </nav>
  );
}
