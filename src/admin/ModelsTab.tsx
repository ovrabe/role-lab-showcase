import { endpointStats, group, modelStats, series, spendOfDay, sumDays } from "./aggregate";
import { count, DataTable, DayBars, percent, usd } from "./AdminParts";
import type { AdminOverview } from "./adminApi";

// "Modely a útrata": speed and reliability per endpoint, tokens and dollars per model, and why
// the custom task generator refused its own answers.

const endpointNames: Record<string, string> = {
  chat: "Asistent", evaluate: "Hodnocení", challenge: "Výzvy", why: "Proč tohle skóre?", customTask: "Generátor vlastní výzvy",
};

export function ModelsTab({ data }: { data: AdminOverview }) {
  const total = sumDays(data.days);
  const endpoints = endpointStats(total);
  const models = modelStats(total);
  const spend = models.reduce((sum, row) => sum + row.usd, 0);
  const evaluated = Object.entries(total).reduce((sum, [name, value]) => (/^outcome\.[^.]+\.count$/.test(name) ? sum + value : sum), 0);
  const rejected = Object.entries(group(total, "customTask.rejected.")).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-6">
      <DayBars title="Útrata po dnech" points={series(data.days, (day) => spendOfDay(day.metrics))} format={usd} />
      <p className="text-sm text-ink-muted">
        Celkem {usd(spend)}. {evaluated > 0 ? `Na jeden ohodnocený pokus připadá ${usd(spend / evaluated)} (asistent, hodnocení i ostatní volání).` : ""}
      </p>
      <h2 className="text-base font-semibold">Rychlost a spolehlivost</h2>
      <DataTable
        head={["Co", "Volání", "Chyby", "Průměr", "Medián", "Nejpomalejší desetina", "Kódy chyb"]}
        rows={endpoints.map((row) => [
          endpointNames[row.endpoint] ?? row.endpoint,
          count(row.calls),
          `${count(row.errors)} (${percent(row.errors, row.calls)})`,
          row.averageSeconds === null ? "–" : `${String(row.averageSeconds).replace(".", ",")} s`,
          row.median ?? "–",
          row.p90 ?? "–",
          Object.entries(row.errorCodes).map(([code, value]) => `${code} ${value}×`).join(", ") || "–",
        ])}
      />
      <h2 className="text-base font-semibold">Modely, tokeny a cena</h2>
      <DataTable
        head={["Co", "Model", "Volání", "Vstup (tokeny)", "Výstup (tokeny)", "Cena"]}
        rows={models.map((row) => [endpointNames[row.endpoint] ?? row.endpoint, row.model, count(row.calls), count(row.inputTokens), count(row.outputTokens), usd(row.usd)])}
      />
      <p className="text-xs text-ink-muted">Cena je spočítaná z tokenů podle ceníku v kódu (server/spendBudget.ts), skutečnou fakturu ukazuje konzole Anthropicu.</p>
      <h2 className="text-base font-semibold">Odmítnuté odpovědi generátoru vlastní výzvy</h2>
      <DataTable head={["Důvod", "Počet"]} rows={rejected.map(([reason, value]) => [reason, count(value)])} empty="Generátor nic neodmítl." />
    </div>
  );
}
