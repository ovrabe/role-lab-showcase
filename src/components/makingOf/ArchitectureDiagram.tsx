import { AppWindow, Clock, Database, Lock, Server, ShieldCheck, Sparkles, TriangleAlert, Zap } from "lucide-react";
import type { ReactNode } from "react";
import { monoDetailClass, panelClass } from "./makingOfStyles";

// One evaluation from the browser to Claude and back, numbered 1–4. Drawn in HTML rather
// than SVG so the boxes reflow on a phone (stacked, flow labels between them) and take the
// theme colours. Each box reads twice: a sentence for anyone, a technical line in mono.

const endpoints = ["/chat", "/evaluate", "/challenge", "/why", "/example", "/feedback", "/stats"];

const operations = [
  { icon: Clock, text: "hodnocení ~35 s" },
  { icon: Database, text: "Redis: limity a denní rozpočet" },
  { icon: Zap, text: "prompt caching u asistenta" },
  { icon: TriangleAlert, text: "výpadek → upozornění, pokus se vrací" },
  { icon: ShieldCheck, text: "CSP · kontrola původu" },
];

export function ArchitectureDiagram() {
  return (
    <figure className="mb-6 lg:-mx-28">
      <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_6.5rem_minmax(0,1.4fr)_6.5rem_minmax(0,1fr)] lg:gap-1">
        <Box icon={<AppWindow size={16} />} title="Prohlížeč" text="Stránka, chat a historie pokusů. Bez účtu.">
          React 19 · TypeScript
          <br />1 soubor · localStorage
        </Box>
        <Flow forward="záznam" back="skóre" forwardStep={1} backStep={4} />
        <div className="rounded-[12px] border border-accent bg-surface p-3.5">
          <BoxTitle icon={<Server size={16} />}>Server · Vercel</BoxTitle>
          <p className="mt-0.5 text-sm text-ink-muted">Doplní pokyny, ověří citace, spočítá úroveň.</p>
          <ul className="my-2 flex flex-wrap gap-1" aria-label="Serverové funkce">
            {endpoints.map((endpoint) => (
              <li key={endpoint} className="rounded-[5px] bg-accent/10 px-1.5 py-px font-mono text-[11px] text-accent">
                {endpoint}
              </li>
            ))}
          </ul>
          <div className="rounded-[8px] bg-notice px-2.5 py-1.5 text-notice-ink">
            <p className="flex items-center gap-1.5 text-sm font-medium">
              <Lock aria-hidden="true" size={14} />
              Nikdy neopustí server
            </p>
            <p className="text-xs">API klíč · pokyny pro modely · klíč k záludnostem</p>
          </div>
        </div>
        <Flow forward="+ pokyny" back="JSON" forwardStep={2} backStep={3} />
        <Box icon={<Sparkles size={16} />} title="Claude" text="Model podle náročnosti úlohy.">
          Opus · hodnotitel
          <br />
          Sonnet · asistent
          <br />
          Haiku · výzvy
        </Box>
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 font-mono text-xs text-ink-muted">
        {operations.map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-center gap-1.5">
            <Icon aria-hidden="true" size={13} />
            {text}
          </li>
        ))}
      </ul>
    </figure>
  );
}

function BoxTitle({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <p className="flex items-center gap-1.5 font-medium">
      <span aria-hidden="true" className="text-accent">
        {icon}
      </span>
      {children}
    </p>
  );
}

function Box({ icon, title, text, children }: { icon: ReactNode; title: string; text: string; children: ReactNode }) {
  return (
    <div className={`${panelClass} p-3.5`}>
      <BoxTitle icon={icon}>{title}</BoxTitle>
      <p className="mt-0.5 mb-2 text-sm text-ink-muted">{text}</p>
      <p className={monoDetailClass}>{children}</p>
    </div>
  );
}

// Between two boxes: what goes there and what comes back. Arrows point right on a wide
// screen and down on narrower ones, where the boxes stack. On a wide screen the figure
// reaches past the text column, five columns do not fit into its 42 rem.
function Flow({ forward, back, forwardStep, backStep }: { forward: string; back: string; forwardStep: number; backStep: number }) {
  return (
    <div className="flex items-center justify-center gap-4 font-mono text-xs text-ink-muted whitespace-nowrap lg:flex-col lg:gap-2">
      <span className="flex items-center gap-1 lg:w-full lg:justify-center lg:border-t-[0.5px] lg:border-ink-muted/60 lg:pt-1">
        <Step number={forwardStep} />
        {forward}
        <span aria-hidden="true" className="lg:hidden">↓</span>
        <span aria-hidden="true" className="hidden lg:inline">→</span>
      </span>
      <span className="flex items-center gap-1 lg:w-full lg:justify-center lg:border-t-[0.5px] lg:border-ink-muted/60 lg:pt-1">
        <span aria-hidden="true" className="lg:hidden">↑</span>
        <span aria-hidden="true" className="hidden lg:inline">←</span>
        {back}
        <Step number={backStep} />
      </span>
    </div>
  );
}

function Step({ number }: { number: number }) {
  return (
    <span className="grid size-4 shrink-0 place-items-center rounded-full bg-accent text-[10px] font-medium text-accent-contrast">
      {number}
    </span>
  );
}
