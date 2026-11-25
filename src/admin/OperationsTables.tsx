import { group, type MetricEntries } from "./aggregate";
import { count, DataTable } from "./AdminParts";

// The detailed operating tables (screens, safety counters, daily limits), moved from the
// overview to "Modely a útrata" so the overview stays about the big picture.

const screenNames: Record<string, string> = {
  home: "Úvod", task: "Úkol", role: "Úkoly role", tour: "Prohlídka", challenge: "Výzva", challengeMap: "Mapa výzev",
  customTask: "Vlastní výzva", profile: "Profil", methodology: "Jak hodnotíme", about: "O projektu", makingOf: "Jak vznikl",
  releaseNotes: "Co je nového", testing: "Scénář pro testery", calibration: "Kalibrace", samples: "Ukázky",
};

const safetyNames: Record<string, string> = {
  "security.sensitive_data_blocked": "Zablokované osobní údaje ve vlastní výzvě",
  "budget.refused.limit_person": "Odmítnuto: rozpočet jedné adresy",
  "budget.refused.limit_daily": "Odmítnuto: denní rozpočet všech",
  "budget.refused.busy": "Odmítnuto na chvíli: rozpočet drží běžící volání",
  "client_error.render": "Chyba stránky při vykreslení",
  "client_error.script": "Chyba skriptu na stránce",
};

export function OperationsTables({ total }: { total: MetricEntries }) {
  const screens = Object.entries(group(total, "screen.")).sort((a, b) => b[1] - a[1]);
  const limits = Object.entries(group(total, "limit.")).sort((a, b) => b[1] - a[1]);
  return (
    <>
      <h2 className="text-base font-semibold">Otevřené obrazovky</h2>
      <DataTable head={["Obrazovka", "Zobrazení"]} rows={screens.map(([screen, value]) => [screenNames[screen] ?? screen, count(value)])} />
      <h2 className="text-base font-semibold">Bezpečnost a chyby stránky</h2>
      <DataTable head={["Co", "Počet"]} rows={Object.entries(safetyNames).map(([name, label]) => [label, count(total[name] ?? 0)])} />
      <h2 className="text-base font-semibold">Zásahy denních limitů</h2>
      <DataTable
        head={["Akce", "Kdo", "Počet"]}
        rows={limits.map(([name, value]) => {
          const [action, code] = name.split(".");
          return [action, code === "limit_daily" ? "všichni" : "jeden člověk", count(value)];
        })}
        empty="Nikdo nenarazil na denní limit."
      />
    </>
  );
}
