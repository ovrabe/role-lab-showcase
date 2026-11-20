import { Code, FileText, FlaskConical, Rocket, ShieldCheck, Tag } from "lucide-react";
import { pipeline } from "./makingOfContent";

// The path of every change to production, drawn like a CI pipeline: one row on a wide
// screen, two rows of three on a phone (the connecting line is shown only in one row).

const icons = { spec: FileText, code: Code, tests: FlaskConical, build: ShieldCheck, release: Tag, production: Rocket };

export function DeliveryPipeline() {
  return (
    <div className="relative mb-3 lg:-mx-28">
      <span aria-hidden="true" className="absolute inset-x-[8.33%] top-[15px] hidden border-t-[0.5px] border-ink-muted/60 sm:block" />
      <ol className="relative grid grid-cols-3 gap-y-5 sm:grid-cols-6">
        {pipeline.map((stage) => {
          const Icon = icons[stage.icon];
          return (
            <li key={stage.title} className="relative px-1 text-center">
              <span className="mx-auto mb-2 grid size-[30px] place-items-center rounded-full bg-surface text-progress">
                <span className="grid size-full place-items-center rounded-full bg-progress/15">
                  <Icon aria-hidden="true" size={15} />
                </span>
              </span>
              <span className="block text-sm font-medium">{stage.title}</span>
              <span className="block font-mono text-[11px] leading-snug text-ink-muted">{stage.detail}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
