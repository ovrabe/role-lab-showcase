import { callsOfDay, errorsOfDay, group, series, spendOfDay, sumDays } from "./aggregate";
import { count, DataTable, DayBars, StatTile, usd } from "./AdminParts";
import type { AdminOverview } from "./adminApi";

// "Přehled": visitors, what they open, money and errors, and the safety counters.

const screenNames: Record<string, string> = {
  home: "Úvod", task: "Úkol", role: "Úkoly role", tour: "Prohlídka", challenge: "Výzva", challengeMap: "Mapa výzev",
  customTask: "Vlastní výzva", profile: "Profil", methodology: "Jak hodnotíme", about: "O projektu", makingOf: "Jak vznikl",
  releaseNotes: "Co je nového", testing: "Scénář pro testery", calibration: "Kalibrace", samples: "Ukázky",
};

const safetyNames: Record<string, string> = {
  "security.sensitive_data_blocked": "Zablokované osobní údaje ve vlastní výzvě",
  "budget.refused.limit_person": "Odmítnuto: rozpočet jedné adresy",
  "budget.refused.limit_daily": "Odmítnuto: denní rozpočet všech",
  "client_error.render": "Chyba stránky při vykreslení",
  "client_error.script": "Chyba skriptu na stránce",
};

export function OverviewTab({ data }: { data: AdminOverview }) {
  const total = sumDays(data.days);
  const visitors = data.days.reduce((sum, day) => sum + day.visitors, 0);
  const evaluated = Object.entries(total).reduce((sum, [name, value]) => (/^outcome\.[^.]+\.count$/.test(name) ? sum + value : sum), 0);
  const calls = callsOfDay(total);
  const errors = errorsOfDay(total);
  const screens = Object.entries(group(total, "screen.")).sort((a, b) => b[1] - a[1]);
  const limits = Object.entries(group(total, "limit.")).sort((a, b) => b[1] - a[1]);
  const safety = Object.entries(safetyNames).map(([name, label]) => [label, count(total[name] ?? 0)]);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <StatTile label="Návštěvníci" value={count(visitors)} note="součet denních odhadů" />
        <StatTile label="Ohodnocené pokusy" value={count(evaluated)} note={`dokončené prohlídky: ${count(total["tour.completed"] ?? 0)}`} />
        <StatTile label="Útrata dnes" value={usd(data.budget.spentTodayUsd)} note={`strop ${usd(data.budget.totalUsd)} denně`} />
        <StatTile label="Chyby volání" value={count(errors)} note={calls > 0 ? `z ${count(calls)} volání modelů` : "žádná volání"} />
      </div>
      <DayBars title="Návštěvníci po dnech" points={series(data.days, (day) => day.visitors)} format={count} />
      <DayBars title="Útrata po dnech" points={series(data.days, (day) => spendOfDay(day.metrics))} format={usd} />
      <h2 className="text-base font-semibold">Otevřené obrazovky</h2>
      <DataTable head={["Obrazovka", "Zobrazení"]} rows={screens.map(([screen, value]) => [screenNames[screen] ?? screen, count(value)])} />
      <h2 className="text-base font-semibold">Bezpečnost a chyby stránky</h2>
      <DataTable head={["Co", "Počet"]} rows={safety} />
      <h2 className="text-base font-semibold">Zásahy denních limitů</h2>
      <DataTable
        head={["Akce", "Kdo", "Počet"]}
        rows={limits.map(([name, value]) => {
          const [action, code] = name.split(".");
          return [action, code === "limit_daily" ? "všichni" : "jeden člověk", count(value)];
        })}
        empty="Nikdo nenarazil na denní limit."
      />
    </div>
  );
}
