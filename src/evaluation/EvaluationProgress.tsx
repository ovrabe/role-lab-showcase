import { useEffect, useMemo, useState } from "react";
import { Check } from "lucide-react";
import tips from "../../data/tips.json";

/**
 * What the evaluator works through while the person waits, so the wait does not look stuck.
 * The page cannot see inside the evaluator: the steps follow the usual timing (about 35 s on
 * the web), and the last one stays until the result arrives. Below them one prompt tip.
 */
const steps = [
  { from: 0, text: "Čtu záznam práce a odevzdání" },
  { from: 8, text: "Porovnávám postup s rubrikou a s tím, co bylo v datech" },
  { from: 20, text: "Ověřuji citace v záznamu" },
  { from: 32, text: "Píšu shrnutí a kroky na příště" },
];

const allTips = Object.entries(tips)
  .filter(([key]) => key !== "_note")
  .flatMap(([, list]) => list as string[]);

export function EvaluationProgress() {
  const [seconds, setSeconds] = useState(0);
  // One tip per wait, chosen once so it does not jump while reading.
  const tip = useMemo(() => allTips[Math.floor(Math.random() * allTips.length)], []);

  useEffect(() => {
    const started = Date.now();
    const timer = window.setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const current = steps.filter((step) => seconds >= step.from).length - 1;
  return (
    <div className="space-y-3">
      <ol className="space-y-1.5" aria-label="Průběh hodnocení">
        {steps.map((step, index) => (
          <li key={step.text} className={`flex items-center gap-2 ${index > current ? "text-ink-muted opacity-60" : ""}`}>
            {index < current ? (
              <Check aria-hidden="true" size={16} className="shrink-0 text-progress" />
            ) : (
              <span aria-hidden="true" className={`shrink-0 size-4 grid place-items-center`}>
                <span className={`size-2 rounded-full ${index === current ? "bg-progress animate-pulse" : "bg-line"}`} />
              </span>
            )}
            <span className={index === current ? "font-medium" : ""}>
              {step.text}
              {index === current ? "…" : ""}
            </span>
          </li>
        ))}
      </ol>
      <p className="rounded-control bg-paper p-3 text-sm">
        <span className="font-semibold">Tip na příště: </span>
        {tip}
      </p>
    </div>
  );
}
