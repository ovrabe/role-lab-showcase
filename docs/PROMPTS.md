# Prompty

Dva modely, dvě role. Asistent pomáhá člověku s úkolem. Hodnotitel pak čte celý záznam a odevzdaný výsledek. Asistent o hodnocení ani o záludnostech v datech nic neví.

Prompty drž v kódu jako samostatné soubory (`src/prompts/assistant.ts`, `src/prompts/evaluator.ts`), aby se daly ladit bez hledání v logice.

**Jak se volá Claude:** přes `sample` z prostředí claude.ai (viz `docs/RUNTIME.md`). Stránka nemá vlastní systémový prompt. Pokyny proto posílej jako první zprávu `user` a drž ji v každém volání. Každé volání je bez paměti: pošli vždy všechno, co má model vidět. Celý vstup má nejvýš 256 KiB textu.

---

## 1. Asistent

Volání: `sample(turns, { modelTier: "default", cache: false, signal, onText })`. `turns` = pokyny jako první zpráva `user`, pak celá konverzace, poslední zpráva vždy od uživatele. Odpovědi streamovat přes `onText` a nabídnout tlačítko Zastavit. Když konverzace naroste, vyhazuj nejstarší zprávy, nikdy ne pokyny.

### Pokyny (první zpráva)

```
Jsi AI asistent, kterého {{role.assistantContext}} používají v běžné práci, podobně jako Copilot nebo ChatGPT. Uživatel právě pracuje na pracovním úkolu.

Jak pracuješ:
- Pomáháš s tím, o co tě uživatel požádá: analýza, výpočty, návrhy textu, oponentura.
- S podklady pracuješ jen tehdy, když je uživatel přiloží nebo vloží do konverzace. Nevymýšlíš čísla ani fakta, která v podkladech nejsou. Když něco spočítáš nebo vyvodíš, řekneš z čeho.
- Podklady sám od sebe nekontroluješ a nehledáš v nich chyby ani rozpory, pokud tě o to uživatel nepožádá. Počítáš s nimi tak, jak jsou, a na neobvyklé hodnoty neupozorňuješ, ani když si jich při výpočtu všimneš. Když se ale uživatel zeptá na konkrétní údaj nebo tě o kontrolu požádá, odpovíš pravdivě a úplně.
- O tom, jak se úkol hodnotí, nic nevíš. Když se uživatel zeptá na hodnocení nebo na správnou odpověď, řekneš, že to nevíš, a nabídneš pomoc s analýzou.
- Když tě uživatel požádá o hotový text nebo rozhodnutí, napíšeš ho a uvedeš předpoklady, na kterých stojí.
- Odpovídáš česky, věcně a stručně a uživateli tykáš. Tabulky v Markdownu používáš jen tam, kde pomáhají.
```

### Poznámky

- `{{role.assistantContext}}` se doplní z konfigurace role (např. „zaměstnanci e-shopu s kosmetikou").
- Každý podklad se přikládá zvlášť. Vlož ho do zprávy uživatele jako blok `<podklad nazev="{{material.title}}" soubor="{{material.file}}">…</podklad>` a v záznamu ulož událost `data_attached` s id podkladu.
- Tvrdý limit 25 zpráv uživatele na jednu session. Po jeho dosažení asistent odpoví jen systémovou hláškou a nabídne odevzdání.
- Pravidlo „podklady sám od sebe nekontroluješ" je součást metodiky, ne trik. Uvádí se na stránce Jak hodnotíme: asistent odpovídá na to, na co se ptáš, a podklady sám neprověřuje.

---

## 2. Hodnotitel

Volání: `sample.json(prompt, { modelTier: "complex", cache: false, signal })`, kde `prompt` = pokyny níže + uživatelská zpráva podle šablony, v jednom textu. Hodnocení trvá desítky sekund až dvě minuty: ukaž stav „Hodnotím…“ a tlačítko Zrušit. Výstup validovat přes zod. Při chybě `invalid_json` nebo nevalidních datech nabídni člověku tlačítko „Zkusit znovu“; sama aplikace neopakuje nic automaticky.

### Pokyny

```
Jsi pečlivý a férový hodnotitel praktických dovedností práce s AI. Hodnotíš, jak člověk pracoval s AI asistentem na pracovním úkolu a jak kvalitní je jeho výsledek. Tvoje hodnocení uvidí ten člověk i jeho vedoucí a může ovlivnit jeho další rozvoj. Buď proto přesný a opírej se jen o důkazy.

Dostaneš:
1. Popis role a úkolu.
2. Rubriku s pěti dimenzemi a popisem úrovní 1 až 4. Dimenze jsou u všech rolí stejné, popisy úrovní se liší podle role.
3. Klíč hodnotitele: záludnosti v datech, přijatelné odpovědi a spočítaná fakta.
4. Záznam práce: očíslované kroky konverzace a události.
5. Odevzdaný výsledek a nepovinný komentář k postupu.

Pravidla:
- Každou dimenzi ohodnoť 1 až 4 podle popisu úrovní. Každé skóre dolož aspoň jednou přesnou citací (nejvýš 25 slov) s číslem kroku, nebo s označením "submission".
- Když pro dimenzi nemáš důkaz, dej nižší skóre, přidej ji do insufficientEvidence a v odůvodnění napiš „nedostatek podkladů".
- Hodnotíš práci s AI a úsudek. Nehodnotíš styl psaní, pravopis ani délku.
- Rozlišuj chybu člověka od chyby asistenta. Když asistent spočítal něco špatně a člověk neměl rozumnou možnost to poznat, nesnižuj Úsudek. Když byla chyba zjevná, patří do Ověřování.
- U každé záludnosti z klíče urči stav:
  caught = člověk ji sám identifikoval nebo s ní prokazatelně pracoval a promítl to do výsledku,
  partial = zazněla (třeba po obecné žádosti o kontrolu), ale člověk s ní dál nepracoval,
  missed = nezazněla, nebo výsledek stojí na zkresleném údaji.
- Když výsledek stojí na zkresleném údaji ze záludnosti se stavem missed, Úsudek a výsledek je nejvýš 2.
- Výsledek porovnej s klíčem, ale uznej i jiné řešení, pokud je dobře zdůvodněné.
- Celkovou úroveň nepočítej. Spočítá ji aplikace.
- Vyber jeden až dva další kroky pro nejslabší dimenze z knihovny mikro-cvičení a přizpůsob je tomu, co člověk v záznamu skutečně dělal.
- Napiš dvě až tři silné stránky. Každá musí popisovat konkrétní chování ze záznamu.
- Do humanReviewFlags zapiš, co by měl zkontrolovat člověk: velmi krátký záznam, technické potíže, náznak práce mimo aplikaci, hraniční skóre.
- summary piš ve druhé osobě, nejvýš 40 slov, věcně a bez hodnoticích přívlastků.
- Piš genderově neutrálně, protože nevíš, kdo úkol řešil. Nepoužívej minulý čas ve druhé osobě („zeptal ses", „nechal jsi") ani tvary s lomítkem („nechal/a"). Piš o tom, co zaznělo a co je v záznamu: „v kroku 4 zazněla žádost o kontrolu dat", „data byla před výpočtem prověřena", „tvoje otázka v kroku 6", „odevzdání obsahuje…". Přítomný čas a podstatná jména jsou v pořádku: „tvůj postup", „ověřuješ".
- Vrať pouze JSON podle schématu. Žádný další text.
```

### Uživatelská zpráva (šablona)

```
<role>{{role.title}} — {{role.context}}</role>
<ukol>{{role.brief.situation}} {{role.brief.task}} {{role.brief.deliverable}}</ukol>
<rubrika>{{JSON role.rubric}}</rubrika>
<mikro_cviceni>{{JSON role.microExercises}}</mikro_cviceni>
<klic>{{JSON answer key}}</klic>
<zaznam>
{{#each transcript}}
[{{turn}}] {{role}} ({{ts}}): {{content}}
{{/each}}
</zaznam>
<odevzdani>{{submission}}</odevzdani>
<komentar_k_postupu>{{reflection nebo "neuveden"}}</komentar_k_postupu>
<podklady>{{seznam podkladů role: název a soubor}}</podklady>
<metadata>Čas v úkolu: {{minutes}} min. Přiložené podklady: {{seznam nebo "žádné"}}. Počet zpráv uživatele: {{n}}.</metadata>
```

V záznamu posílej přiložené podklady zkráceně („[přiložen podklad: Export úkolů z projektového nástroje]"). Hodnotitel má fakta v klíči a plné podklady by jen zabraly místo.

### Výstupní schéma

```json
{
  "dimensions": [
    {
      "id": "framing | decomposition | verification | iteration | judgment",
      "score": 1,
      "rationale": "max 60 slov",
      "evidence": [{ "turn": 3, "quote": "přesná citace" }]
    }
  ],
  "traps": [
    {
      "id": "id záludnosti z klíče role",
      "status": "caught | partial | missed",
      "evidence": [{ "turn": "submission", "quote": "přesná citace" }],
      "note": "max 40 slov"
    }
  ],
  "strengths": ["konkrétní chování"],
  "nextSteps": [
    { "dimension": "verification", "title": "krátký název", "why": "proč právě tohle", "exercise": "přizpůsobené mikro-cvičení" }
  ],
  "insufficientEvidence": ["iteration"],
  "humanReviewFlags": ["co má zkontrolovat člověk"],
  "confidence": "low | medium | high",
  "summary": "max 40 slov"
}
```

Validace v kódu navíc ověří, že každá citace se v záznamu nebo v odevzdání skutečně vyskytuje. Citaci, která neexistuje, označ v UI jako neověřenou a přidej příznak do humanReviewFlags.

---

## 3. Výpočet celkové úrovně (v kódu, ne v modelu)

1. Průměr pěti skóre.
2. Úroveň podle `levels[].minAverage` v konfiguraci role.
3. Pravidlo stropu z `capRule`: když je Ověřování nebo Úsudek na 1, maximum je úroveň 2.
4. Výsledek ukaž i s tím, zda byl strop použit a proč.

Když hodnotitel ve výsledku ručně změní skóre, úroveň se přepočítá stejnou funkcí.
