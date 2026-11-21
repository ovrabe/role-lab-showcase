import { Markdown } from "../components/Markdown";
import { plural } from "./dataSummary";
import { parseSimpleCsv } from "./generatedTask";
import type { PublicGeneratedTask } from "./generatedTask";

// What was generated, before it opens as a task with the assistant.
export function GeneratedPreview({ task, onStart }: { task: PublicGeneratedTask; onStart: () => void }) {
  const [header, ...rows] = parseSimpleCsv(task.table.csv);
  return (
    <section aria-labelledby="generated-heading" className="card space-y-3">
      <p className="text-sm text-ink-muted">
        {task.roleTitle} · <span className="rounded-full bg-paper px-2 py-0.5">beta · nekalibrováno</span>
      </p>
      <h2 id="generated-heading">{task.title}</h2>
      <p>{task.brief.situation}</p>
      <p className="font-semibold">{task.brief.task}</p>
      <p className="text-ink-muted">{task.brief.deliverable}</p>
      <h3 className="font-semibold">{task.table.title}</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm tabular-nums">
          <thead>
            <tr>
              {header.map((name) => (
                <th key={name} className="pr-3 py-1 font-medium">{name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 6).map((row, index) => (
              <tr key={index} className="border-t border-line">
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="pr-3 py-1">{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-ink-muted">Celkem {plural(rows.length, "řádek", "řádky", "řádků")}.</p>
      <h3 className="font-semibold">{task.notes.title}</h3>
      <Markdown text={task.notes.markdown} />
      <button type="button" onClick={onStart} className="rl-submit-sweep rounded-full px-6 py-2.5 font-semibold">
        Začít řešit
      </button>
    </section>
  );
}
