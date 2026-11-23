import { useEffect, useState } from "react";
import { RefreshCw, Sparkles } from "lucide-react";
import { fetchSummary, type AdminSummary } from "./adminApi";

/**
 * The AI summary at the top of the overview (docs/PROMPTS.md, section 7): written by the quick
 * model from the anonymous totals, kept for the day on the server. "Napsat znovu" asks for a
 * new one (a fraction of a cent). In the app's warm sweep, like the home banner.
 */
export function SummaryCard({ token, days }: { token: string; days: number }) {
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load(refresh: boolean) {
    setLoading(true);
    setError(null);
    const result = await fetchSummary(token, days, refresh);
    setLoading(false);
    if (result.ok) setSummary(result.value);
    else setError("Shrnutí se nepodařilo napsat. Zkus to znovu.");
  }

  useEffect(() => {
    setSummary(null);
    void load(false);
    // A new period means a new summary; the token does not change while the page is open.
  }, [days]);

  return (
    <section aria-labelledby="summary-heading" className="rounded-[28px] p-7 text-white bg-[image:var(--action-sweep)] flex flex-col gap-3 min-w-0">
      <p id="summary-heading" className="flex items-center gap-2 text-sm font-semibold text-white/90">
        <Sparkles aria-hidden="true" size={16} /> Shrnutí za {days} dní · napsal Claude z anonymních součtů
      </p>
      {loading && !summary && <p className="text-lg">Píšu shrnutí…</p>}
      {error && <p className="text-lg">{error}</p>}
      {summary && (
        <>
          <p className="text-xl sm:text-2xl font-semibold leading-snug">{summary.headline}</p>
          <p className="text-base leading-relaxed text-white/90">{summary.details}</p>
        </>
      )}
      <div>
        <button
          type="button"
          onClick={() => void load(true)}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-full border border-white/50 bg-white/15 px-4 py-2 text-sm font-semibold disabled:opacity-60"
        >
          <RefreshCw aria-hidden="true" size={14} /> {loading ? "Píšu…" : "Napsat znovu"}
        </button>
      </div>
    </section>
  );
}
