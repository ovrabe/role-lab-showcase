import { describe, expect, it } from "vitest";
import { loadRoles } from "./loadRoles";
import { firstSentence } from "./firstSentence";

describe("firstSentence", () => {
  it("ends at a full stop before a capital letter", () => {
    expect(firstSentence("Doporuč, kterou variantu nasadit. Vedoucí podpory upozorňuje.")).toBe("Doporuč, kterou variantu nasadit.");
  });

  it("does not stop inside a date", () => {
    expect(firstSentence("Doporuč, jestli chatbota od 1. 2. 2027 rozšířit. Ředitelka chce rozhodnout v pátek.")).toBe(
      "Doporuč, jestli chatbota od 1. 2. 2027 rozšířit.",
    );
    expect(firstSentence("Objednej zboží do neděle 29. 11. kvůli Black Friday. Sklad zavírá dřív.")).toBe(
      "Objednej zboží do neděle 29. 11. kvůli Black Friday.",
    );
  });

  it("handles a capital letter with a diacritic, a question and a single sentence", () => {
    expect(firstSentence("Vydat verzi 3.8? Řekni to do 9:30.")).toBe("Vydat verzi 3.8?");
    expect(firstSentence("Rozhodni, v jakém pořadí požadavky vezmeš.")).toBe("Rozhodni, v jakém pořadí požadavky vezmeš.");
    expect(firstSentence("Bez tečky na konci")).toBe("Bez tečky na konci");
  });

  // Every task's card text is one whole sentence: it ends with a full stop, a question mark or an exclamation mark.
  const { activeRoles } = loadRoles();
  it.each(activeRoles.map((task) => [task.id, task.brief.task] as const))("%s has a whole first sentence", (_id, task) => {
    const sentence = firstSentence(task);
    expect(sentence).toMatch(/[.!?]$/);
    expect(sentence.length).toBeGreaterThan(20);
  });
});
