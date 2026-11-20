import { ExternalLink, Play } from "lucide-react";
import { appVersion } from "../buildFlags";
import { ArchitectureDiagram } from "../components/makingOf/ArchitectureDiagram";
import { DeliveryPipeline } from "../components/makingOf/DeliveryPipeline";
import { DevelopmentChart } from "../components/makingOf/DevelopmentChart";
import { benefits, decisions, figures, sourceCodeUrl, statusDate, threats } from "../components/makingOf/makingOfContent";
import { panelClass } from "../components/makingOf/makingOfStyles";

// How Role Lab was built: a factual record for people who look at the project as a reference.
// Order: why and how fast (for anyone), how it works (for technical readers), how decisions
// were made. Neutral on purpose: no personal bio, no comparison without a source, no money.

// The real function from src/evaluation/verifyQuote.ts, comments left out. Keep in sync.
const quoteCheckCode = `export function quoteAppearsIn(quote: string, source: string): boolean {
  const normalizedSource = \` \${normalizeForQuotes(source)} \`;
  const parts = quoteParts(quote);
  if (parts.length === 0) return false;

  let searchFrom = 0;
  for (const part of parts) {
    const index = normalizedSource.indexOf(\` \${part} \`, searchFrom);
    if (index < 0) return false;
    searchFrom = index + part.length + 1;
  }
  return true;
}`;

const outcomeClass = {
  accepted: "bg-progress/15 text-progress",
  rejected: "bg-notice text-notice-ink",
  stopped: "bg-paper text-ink-muted ring-1 ring-line",
};

type MakingOfScreenProps = { onOpenTour: () => void };

/** How the project was built. Web version only, like the About page. */
export function MakingOfScreen({ onOpenTour }: MakingOfScreenProps) {
  return (
    <article className="max-w-2xl mx-auto">
      <h1 className="mb-1">Jak vznikl Role Lab</h1>
      <p className="mb-6 text-sm text-ink-muted tabular-nums">
        Stav k {statusDate} · verze {appVersion}
      </p>
      <p className="mb-8">
        Role Lab vznikl jako ověření AI-first přístupu: jak rychle a v jaké kvalitě jde postavit nový produkt, když AI
        (Claude Code) píše kód, testy a revize a člověk určuje směr, kontroluje kvalitu a rozhoduje o riziku a nákladech. Funkční produkt vznikl za víkend.
      </p>

      <h2 className="mb-3">Co řeší</h2>
      <p className="mb-3">
        Firmy učí lidi pracovat s AI, ale výsledek obvykle měří testem znalostí nebo dotazníkem. Ty neukážou, jestli
        člověk zadá AI práci srozumitelně, ověří její výstup a pozná chybu v datech. Role Lab to měří na práci samotné.
      </p>
      <ul className="mb-8 list-disc space-y-2 pl-5">
        {benefits.map((benefit) => (
          <li key={benefit}>{benefit}</li>
        ))}
      </ul>

      <h2 className="mb-3">V číslech</h2>
      <ul className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {figures.map((figure) => (
          <li key={figure.label} className="rounded-[8px] bg-ink-muted/[0.07] p-4">
            <span className="block text-[13px] text-ink-muted">{figure.label}</span>
            <span className="block text-2xl font-medium tabular-nums">{figure.value}</span>
          </li>
        ))}
      </ul>

      <h2 className="mb-3">Průběh vývoje</h2>
      <DevelopmentChart />
      <p className="mb-8 text-sm text-ink-muted">
        Aktivní práce je odhad z historie změn: mezery mezi změnami do 60 minut se počítají jako práce, delší jako
        přestávka. Zahrnuje i čas, kdy AI pracovala samostatně.
      </p>

      <h2 className="mb-3">Jak to funguje</h2>
      <p className="mb-4">
        Prototyp běžel jako artefakt v claude.ai, kde Clauda platí ten, kdo stránku otevře, a pokyny hodnotitele jsou
        součástí stránky. Pro veřejně dostupný projekt to nestačilo, a tak vznikl samostatný web s vlastním serverem,
        databází pro limity, upozorněními z provozu a kontrolou po každém releasu.
      </p>
      <ArchitectureDiagram />
      <p className="mb-2">
        Úroveň počítá a citace ověřuje kód, ne model. Tahle funkce rozhodne, jestli citace v záznamu opravdu je: celými slovy a
        ve správném pořadí, takže parafráze neprojde.
      </p>
      <pre className={`${panelClass} mb-8 overflow-x-auto p-4 font-mono text-xs leading-relaxed`}>
        <code>{quoteCheckCode}</code>
      </pre>

      <h2 className="mb-3">Hrozby a ochrana</h2>
      <dl className={`${panelClass} mb-8 divide-y-[0.5px] divide-ink-muted/30 px-4 py-1`}>
        {threats.map((item) => (
          <div key={item.threat} className="grid gap-1 py-3 sm:grid-cols-[13rem_1fr] sm:gap-4">
            <dt className="font-medium">{item.threat}</dt>
            <dd className="text-ink-muted">{item.defence}</dd>
          </div>
        ))}
      </dl>

      <h2 className="mb-3">Cesta změny do produkce</h2>
      <DeliveryPipeline />
      <p className="mb-8 text-sm text-ink-muted">
        Každý release projde všemi kroky. Když selže test nebo kontrola sestavení, release se zastaví.
      </p>

      <h2 className="mb-3">Rozhodnutí podle měření</h2>
      <ol className="mb-8 divide-y-[0.5px] divide-ink-muted/30 border-y-[0.5px] border-ink-muted/30">
        {decisions.map((decision) => (
          <li key={decision.title} className="grid gap-x-4 gap-y-1 py-3 sm:grid-cols-[3.5rem_1fr_auto]">
            <span className="font-mono text-xs text-ink-muted sm:pt-0.5">{decision.date}</span>
            <div>
              <p className="font-medium">{decision.title}</p>
              <p className="text-sm text-ink-muted">{decision.reason}</p>
            </div>
            <span className={`h-fit w-fit rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${outcomeClass[decision.tone]}`}>
              {decision.outcome}
            </span>
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onOpenTour}
          className="inline-flex items-center gap-2 rounded-full bg-action px-4 py-2 font-medium text-action-contrast hover:opacity-90"
        >
          <Play aria-hidden="true" size={16} />
          Vyzkoušet za 3 minuty
        </button>
        <a
          href={sourceCodeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-full border-[0.5px] border-ink-muted/60 px-4 py-2 font-medium hover:bg-paper"
        >
          Zdrojový kód na GitHubu
          <ExternalLink aria-hidden="true" size={16} />
          <span className="sr-only">(otevře se v nové kartě)</span>
        </a>
      </div>
    </article>
  );
}
