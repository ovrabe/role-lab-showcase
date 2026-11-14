import { useId, type CSSProperties } from "react";
import { Eye } from "lucide-react";
import type { RoleConfig } from "../roles/roleSchema";
import type { LevelResult } from "../evaluation/computeLevel";
import type { StoredEvaluation } from "../evaluation/evaluationSchema";

const formatAverage = (average: number) => average.toFixed(1).replace(".", ",");

// The overall level as a ring in the data gradient (docs/SPEC.md, section 9). The gradient
// is the same for every level, only the filled share changes: a scale, never a traffic light.
type LevelSummaryProps = {
  role: RoleConfig;
  level: LevelResult;
  summary: string;
  // The AI proposal, passed only when a reviewer changed the scores.
  aiLevel?: LevelResult;
};

const ringRadius = 16;
const ringLength = 2 * Math.PI * ringRadius;

function LevelRing({ value, total }: { value: number; total: number }) {
  const gradientId = useId();
  const offset = ringLength * (1 - value / total);
  return (
    <svg viewBox="0 0 40 40" className="size-20 sm:size-24 shrink-0 -rotate-90" aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8a5cf6" />
          <stop offset="1" stopColor="#5b6cff" />
        </linearGradient>
      </defs>
      <circle cx="20" cy="20" r={ringRadius} fill="none" stroke="var(--color-track)" strokeWidth="3.5" />
      <circle
        cx="20"
        cy="20"
        r={ringRadius}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeDasharray={ringLength}
        strokeDashoffset={offset}
        className="rl-ring-in"
        style={{ "--rl-ring-length": `${ringLength}` } as CSSProperties}
      />
    </svg>
  );
}

export function LevelSummary({ role, level, summary, aiLevel }: LevelSummaryProps) {
  const total = role.levels.length;
  return (
    <section aria-labelledby="level-heading" className="card space-y-4">
      <div className="flex items-center gap-5">
        <LevelRing value={level.level} total={total} />
        <div className="min-w-0">
          <p className="text-sm text-ink-muted">Celková úroveň{aiLevel && ", upravená hodnotitelem"}</p>
          <p className="flex items-baseline gap-1.5" aria-label={`Úroveň ${level.level} ze ${total}`}>
            <span className="text-5xl font-bold tracking-[-0.03em] leading-none tabular-nums">{level.level}</span>
            <span className="text-lg font-semibold text-ink-muted">ze {total}</span>
          </p>
          <h2 id="level-heading" className="mt-1">
            {level.label}
          </h2>
          <p className="text-sm text-ink-muted tabular-nums">Průměr pěti oblastí {formatAverage(level.average)}</p>
        </div>
      </div>
      <p className="text-ink-muted">{level.description}</p>
      {level.capApplied && (
        <p className="rounded-control bg-paper px-4 py-2.5 text-sm">
          <span className="font-semibold">Platí strop.</span> Podle průměru by vyšla úroveň {level.levelBeforeCap}.{" "}
          {level.capReason}
        </p>
      )}
      {aiLevel && (
        <p className="rounded-control bg-paper px-4 py-2.5 text-sm">
          Návrh AI byl úroveň {aiLevel.level} „{aiLevel.label}“ (průměr {formatAverage(aiLevel.average)}).
        </p>
      )}
      <p>{summary}</p>
    </section>
  );
}

const confidenceLabels = { low: "nízká", medium: "střední", high: "vysoká" } as const;

export function ReviewNotes({ evaluation }: { evaluation: StoredEvaluation }) {
  const flags = [...evaluation.codeReviewFlags, ...evaluation.output.humanReviewFlags];
  return (
    <section aria-labelledby="review-heading" className="card space-y-2">
      <h2 id="review-heading">
        Co má zkontrolovat člověk
      </h2>
      <p>Jistota hodnocení: {confidenceLabels[evaluation.output.confidence]}.</p>
      {flags.length > 0 ? (
        <ul className="space-y-2">
          {flags.map((flag) => (
            <li key={flag} className="flex gap-3">
              <Eye aria-hidden="true" size={18} className="shrink-0 mt-0.5 text-ink-muted" />
              <span>{flag}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-ink-muted">Hodnotitel nic zvláštního ke kontrole neuvedl.</p>
      )}
      <p className="pt-2">Hodnocení navrhla AI. Konečné slovo má člověk.</p>
    </section>
  );
}
