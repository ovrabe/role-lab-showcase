import { ShieldAlert } from "lucide-react";
import type { SensitiveFind } from "./sensitiveData";

/** What the check found in the text about to be sent: blocking finds stop the sending. */
export function SensitiveNotice({ finds }: { finds: SensitiveFind[] }) {
  if (finds.length === 0) return null;
  const blocking = finds.some((find) => find.blocking);
  return (
    <div role="alert" className="flex gap-2 rounded-control bg-notice p-3 text-sm text-notice-ink">
      <ShieldAlert aria-hidden="true" size={18} className="mt-0.5 shrink-0" />
      <div>
        <p className="font-semibold">
          {blocking ? "V textu jsou osobní údaje. Odstraň je, jinak úkol nepůjde vygenerovat." : "Zkontroluj, jestli tohle není telefonní číslo."}
        </p>
        <ul className="mt-1 list-disc pl-5">
          {finds.map((find, index) => (
            <li key={index}>
              {find.kind}: <code>{find.text}</code>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
