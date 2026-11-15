import type { DimensionId } from "./roleSchema.js";

// The five skills by name, the same in every role (the rubric's own names may say more,
// like "Úsudek a výsledek"). Used where no role is at hand: badges, challenges.
export const skillNames: Record<DimensionId, string> = {
  framing: "Zadání a kontext",
  decomposition: "Rozklad úkolu",
  verification: "Ověřování",
  iteration: "Iterace",
  judgment: "Úsudek a výsledek",
};
