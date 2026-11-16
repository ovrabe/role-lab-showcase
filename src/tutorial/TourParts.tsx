import type { ReactNode } from "react";
import { Lightbulb } from "lucide-react";
import type { Tour } from "./tour";

// Small building blocks of the guided tour (src/screens/TourScreen.tsx).

// The guide's voice: what to notice on this screen.
export function Coach({ children }: { children: ReactNode }) {
  return (
    <p role="note" className="rl-rise flex gap-3 rounded-control bg-notice text-notice-ink p-4">
      <Lightbulb aria-hidden="true" size={20} className="shrink-0 mt-0.5" />
      <span>{children}</span>
    </p>
  );
}

export function NextButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="rounded-full bg-action text-action-contrast px-5 py-2.5 font-medium">
      {children}
    </button>
  );
}

export function MaterialTable({ tour }: { tour: Tour }) {
  const { material } = tour;
  return (
    <section className="card space-y-3">
      <h2 className="text-base font-semibold">Podklady: {material.title}</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left">
              {material.columns.map((column) => (
                <th key={column} scope="col" className="py-2 pr-4 font-semibold whitespace-nowrap">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {material.rows.map((row) => (
              <tr key={row[0]} className="border-b border-line last:border-0">
                {row.map((cell, index) => (
                  <td key={index} className="py-2 pr-4 whitespace-nowrap tabular-nums">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-ink-muted">{material.note}</p>
    </section>
  );
}
