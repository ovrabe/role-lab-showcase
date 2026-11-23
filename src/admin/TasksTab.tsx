import { activeTasks, group, sumDays, taskStats } from "./aggregate";
import { count, DataTable, percent } from "./AdminParts";
import type { AdminOverview } from "./adminApi";

// "Úkoly": how far people get in each task, how the evaluations turn out, which traps they
// miss, whether trying again helps, where they disagree with the evaluator, and challenges.

const dimensionNames: Record<string, string> = {
  framing: "Zadání", decomposition: "Rozklad", verification: "Ověřování", iteration: "Iterace", judgment: "Úsudek",
};

export function TasksTab({ data }: { data: AdminOverview }) {
  const total = sumDays(data.days);
  const titleOf = (id: string) => {
    if (id === "custom") return "Vlastní výzvy (všechny)";
    const task = data.tasks.find((candidate) => candidate.id === id);
    return task ? `${task.roleTitle}: ${task.taskTitle}` : id;
  };
  const stats = activeTasks(total).map((task) => taskStats(total, task));

  const reviews = group(total, "review.");
  const challenges = Object.entries(group(total, "challenge."))
    .filter(([name]) => name.endsWith(".count"))
    .map(([name, value]) => {
      const id = name.slice(0, -".count".length);
      return [id, count(value), value > 0 ? ((total[`challenge.${id}.score_sum`] ?? 0) / value).toFixed(1).replace(".", ",") : "–"];
    });

  return (
    <div className="space-y-6">
      <h2 className="text-base font-semibold">Průchod úkolem</h2>
      <DataTable
        head={["Úkol", "Začato", "1. zpráva", "Odevzdáno", "Ohodnoceno", "Dokončeno"]}
        rows={stats.map((row) => [titleOf(row.task), count(row.started), count(row.firstMessage), count(row.submitted), count(row.evaluated), percent(row.evaluated, row.started)])}
      />
      <h2 className="text-base font-semibold">Výsledky hodnocení</h2>
      <DataTable
        head={["Úkol", "Průměrná úroveň", "Úrovně 1 / 2 / 3 / 4", ...Object.values(dimensionNames), "Minut", "Zpráv", "Ke kontrole"]}
        rows={stats
          .filter((row) => row.evaluated > 0)
          .map((row) => [
            titleOf(row.task),
            row.averageLevel?.toFixed(1).replace(".", ",") ?? "–",
            [1, 2, 3, 4].map((level) => row.levels[level] ?? 0).join(" / "),
            ...Object.keys(dimensionNames).map((dimension) => row.averageScores[dimension]?.toFixed(1).replace(".", ",") ?? "–"),
            row.averageMinutes ?? "–",
            row.averageMessages ?? "–",
            count(row.flagged),
          ])}
      />
      <h2 className="text-base font-semibold">Záludnosti</h2>
      <DataTable
        head={["Úkol", "Záludnost", "Odhaleno", "Napůl", "Minuto"]}
        rows={stats.flatMap((row) =>
          Object.entries(row.traps).map(([trap, result]) => {
            const all = result.caught + result.partial + result.missed;
            return [titleOf(row.task), trap, percent(result.caught, all), percent(result.partial, all), percent(result.missed, all)];
          }),
        )}
      />
      <h2 className="text-base font-semibold">Opakované pokusy</h2>
      <DataTable
        head={["Úkol", "1. pokus", "2. pokus", "3. pokus", "4. a další", "Úroveň se zlepšila", "zhoršila"]}
        rows={activeTasks(total)
          .filter((task) => Object.keys(group(total, `progress.${task}.`)).length > 0)
          .map((task) => {
            const progress = group(total, `progress.${task}.`);
            const changes = group(progress, "level_change.");
            const better = Object.entries(changes).reduce((sum, [change, value]) => (Number(change) > 0 ? sum + value : sum), 0);
            const worse = Object.entries(changes).reduce((sum, [change, value]) => (Number(change) < 0 ? sum + value : sum), 0);
            return [titleOf(task), ...["1", "2", "3", "4plus"].map((attempt) => count(progress[`attempt.${attempt}`] ?? 0)), count(better), count(worse)];
          })}
        empty="Zatím nikdo neopakoval pokus."
      />
      <h2 className="text-base font-semibold">Ruční úpravy skóre</h2>
      <DataTable
        head={["Úkol", "Oblast", "Nahoru", "Dolů"]}
        rows={[...new Set(Object.keys(reviews).map((name) => name.split(".").slice(0, 2).join(".")))].map((key) => {
          const [task, dimension] = key.split(".");
          return [titleOf(task), dimensionNames[dimension] ?? dimension, count(reviews[`${key}.up`] ?? 0), count(reviews[`${key}.down`] ?? 0)];
        })}
        empty="Nikdo zatím skóre neupravil."
      />
      <h2 className="text-base font-semibold">Výzvy</h2>
      <DataTable head={["Výzva", "Ohodnoceno", "Průměrné skóre"]} rows={challenges} />
    </div>
  );
}
