// Calibration of the evaluator (docs/SPEC.md, M3.5), on the "Jak hodnotíme" page: how stable
// the scores are across repeated runs of the same sample attempts.
// Average of the five areas, scale 1–4, from the
// author's calibration runs. Update together with the samples in fixtures/ after a recalibration.
const calibrationRows = [
  { task: "Hlavní tip do newsletteru", role: "Category manager", difficulty: 1, weak: "1,0", medium: "1,2", strong: "3,2–3,4" },
  { task: "Doporučení před Black Friday", role: "Category manager", difficulty: 2, weak: "1,0–1,2", medium: "2,6–2,8", strong: "4,0" },
  { task: "Objednávka zboží na Black Friday", role: "Category manager", difficulty: 3, weak: "1,2", medium: "2,4–2,6", strong: "3,6–3,8" },
  { task: "Čerpání rozpočtu pro finanční ředitelku", role: "Projektový manažer", difficulty: 1, weak: "1,2", medium: "1,8", strong: "3,0–3,2" },
  { task: "Skutečný stav projektu Kompas", role: "Projektový manažer", difficulty: 2, weak: "1,2", medium: "–", strong: "3,8" },
  { task: "Rozhodnutí o spuštění 2. 11.", role: "Projektový manažer", difficulty: 3, weak: "1,2", medium: "2,4", strong: "3,6–3,8" },
  // Roles added in 1.4.0: one round per run so far, hence single numbers instead of ranges.
  { task: "Model pro třídění požadavků", role: "AI tech lead", difficulty: 1, weak: "1,0", medium: "1,2", strong: "4,0" },
  // Difficulty 2 and 3 of the newer roles, calibrated through the Batch API (three rounds each).
  { task: "Rozšířit chatbota na všechny zákazníky?", role: "AI tech lead", difficulty: 2, weak: "1,2", medium: "2,4", strong: "3,6" },
  { task: "Přechod na nový model", role: "AI tech lead", difficulty: 3, weak: "1,2", medium: "2,2–2,4", strong: "3,6" },
  { task: "Kandidáti do druhého kola", role: "Recruiter", difficulty: 1, weak: "1,0", medium: "1,6", strong: "3,6" },
  { task: "Proč nemůžeme obsadit Data engineera", role: "Recruiter", difficulty: 2, weak: "1,2", medium: "1,8–2,0", strong: "3,0" },
  { task: "Vítězná varianta landing page", role: "Marketér", difficulty: 1, weak: "1,0", medium: "1,4", strong: "3,6" },
  { task: "Rozpočet na lednový výprodej", role: "Marketér", difficulty: 2, weak: "1,2", medium: "1,8–2,0", strong: "3,4–3,6" },
  { task: "Ranní fronta požadavků", role: "IT helpdesk", difficulty: 1, weak: "1,0", medium: "1,6", strong: "2,8" },
  { task: "Proč padá VPN", role: "IT helpdesk", difficulty: 2, weak: "1,0–1,2", medium: "2,0", strong: "3,0–3,2" },
  { task: "Obnova po výpadku serveru", role: "IT helpdesk", difficulty: 3, weak: "1,0–1,2", medium: "1,6–1,8", strong: "3,4–3,6" },
  { task: "Vydat verzi 3.8?", role: "QA", difficulty: 1, weak: "1,0", medium: "1,4", strong: "3,4" },
  { task: "Nestabilní testy", role: "QA", difficulty: 2, weak: "1,0–1,2", medium: "1,6–1,8", strong: "2,8" },
  { task: "Citlivost izolátu na ciprofloxacin", role: "Molekulární biolog", difficulty: 1, weak: "1,0", medium: "1,6", strong: "3,4" },
  { task: "Působí látka K-12 proti zánětu?", role: "Molekulární biolog", difficulty: 2, weak: "1,0–1,2", medium: "1,8–2,2", strong: "3,0–3,2" },
  { task: "Odchylky od rozpočtu za říjen", role: "Controller", difficulty: 1, weak: "1,0", medium: "1,4", strong: "3,6" },
  { task: "Proč klesla marže řady Hydraulika", role: "Controller", difficulty: 2, weak: "1,2", medium: "1,6", strong: "2,8" },
];

export function CalibrationSection() {
  return (
    <>
      <h2 className="mb-3">Kalibrace hodnotitele</h2>
      <p className="mb-4">
        Vzorové pokusy prošly hodnocením opakovaně. Pořadí slabý, střední a silný se nikdy neprohodilo a výsledek
        stejného pokusu se mezi běhy lišil nejvýš o 0,2 bodu. Od verze 1.8.0 hodnotitel pracuje s nižším úsilím, takže je
        levnější a rychlejší. Nové kolo kalibrace na všech 13 úkolech zachovalo pořadí i stav všech záludností a průměry
        se od tabulky liší nejvýš o 0,2 bodu.
      </p>
      <div className="card mb-8 overflow-x-auto">
        <table className="w-full text-left tabular-nums">
          <caption className="caption-bottom pt-3 text-sm text-ink-muted text-left">
            Průměr pěti oblastí na škále 1–4
          </caption>
          <thead className="text-sm text-ink-muted">
            <tr>
              <th className="py-2 pr-4 font-medium">Úkol</th>
              <th className="py-2 pr-4 font-medium">Slabý</th>
              <th className="py-2 pr-4 font-medium">Střední</th>
              <th className="py-2 font-medium">Silný</th>
            </tr>
          </thead>
          <tbody>
            {calibrationRows.map((row) => (
              <tr key={row.task} className="border-t border-line">
                <td className="py-2 pr-4">
                  <span className="block">{row.task}</span>
                  <span className="block text-sm text-ink-muted">
                    {row.role} · obtížnost {row.difficulty}
                  </span>
                </td>
                <td className="py-2 pr-4 whitespace-nowrap">{row.weak}</td>
                <td className="py-2 pr-4 whitespace-nowrap">{row.medium}</td>
                <td className="py-2 whitespace-nowrap">{row.strong}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
