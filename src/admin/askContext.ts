import { activeTasks, modelStats, sumDays, taskStats } from "./aggregate.js";
import { digest } from "./digest.js";
import { attentionItems } from "./attention.js";
import type { AdminOverview } from "./adminApi.js";

/**
 * What "Zeptat se na data" hands to the model (docs/PROMPTS.md, section 8): the same anonymous
 * totals the admin page shows, shaped compactly. Built on the server from the overview, so the
 * page cannot add anything to it. Feedback texts and contacts never go in.
 */
export function askData(data: AdminOverview) {
  const total = sumDays(data.days);
  const titleOf = (id: string) => {
    if (id === "custom") return "Vlastní výzvy (všechny)";
    const task = data.tasks.find((candidate) => candidate.id === id);
    return task ? `${task.roleTitle}: ${task.taskTitle} (obtížnost ${task.difficulty})` : id;
  };
  return {
    obdobi: digest(data.days),
    predchozi_obdobi: digest(data.previousDays),
    ukoly: activeTasks(total).map((task) => {
      const stats = taskStats(total, task);
      return {
        ukol: titleOf(task),
        zacato: stats.started,
        prvni_zprava: stats.firstMessage,
        odevzdano: stats.submitted,
        ohodnoceno: stats.evaluated,
        prumerna_uroven: stats.averageLevel,
        urovne: stats.levels,
        dovednosti: stats.averageScores,
        zaludnosti: stats.traps,
        minut: stats.averageMinutes,
        zprav: stats.averageMessages,
      };
    }),
    modely: modelStats(total),
    dny: [...data.days].reverse().map((day) => {
      const one = digest([day]);
      return { den: day.day, navstevnici: day.visitors, ohodnoceno: one.funnel.evaluated, utrata_usd: one.spendUsd };
    }),
    rozpocet: data.budget,
    upozorneni: attentionItems(data, titleOf).map((item) => item.text),
    cekajici_sdileni: data.pendingShares.length,
  };
}
