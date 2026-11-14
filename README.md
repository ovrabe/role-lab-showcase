# Role Lab

**Try it:** [role-lab-gamma.vercel.app](https://role-lab-gamma.vercel.app)

> **In English, briefly.** Role Lab assesses how a person *works with AI* on a realistic task from their role, not what they know about AI. You solve a work task (e.g. a Black Friday recommendation for a category manager) with an AI assistant; the page records the whole process. A second Claude call then scores it against a public rubric in five areas, every score backed by a quote from the transcript. The overall level is computed by code, not by the model, and a reviewer can adjust each score. A personal project by a non-developer, built by directing Claude Code. The UI is in Czech.

## Co to je

Role Lab netestuje, co člověk o AI ví, ale jak s ní pracuje. Na úkolu, jaký opravdu řeší category manager nebo projektový manažer, je vidět:

- jestli umí AI dobře zadat úkol a dát jí kontext,
- jestli úkol rozloží na kroky,
- jestli ověřuje, co mu AI tvrdí,
- jestli výsledek zlepšuje dalšími kroky,
- a jestli na konci rozhoduje on, ne AI.

V podkladech jsou schované záludnosti, které asistent sám neprozradí. Kdo výstup AI jen převezme, chybu v datech nepozná.

## Jak to funguje

1. Člověk si vybere roli a dostane zadání s podklady (tabulky, zápisy).
2. Úkol řeší v chatu s AI asistentem (Claude Sonnet). Asistent o záludnostech neví.
3. Odevzdá výsledek a krátkou reflexi.
4. Hodnotitel (Claude Opus) dostane celý záznam, rubriku a klíč se záludnostmi a vrátí skóre v pěti oblastech. Každé skóre musí doložit citací.
5. Kód ověří, že citace v záznamu opravdu jsou, a celkovou úroveň spočítá podle pevných pravidel role. Model úroveň nevybírá.
6. Výsledek ukáže skóre, citace, rozbor záludností a doporučené cvičení. Pokrok v pěti dovednostech a odznaky se ukládají jen v prohlížeči.

## Architektura

- **Frontend:** Vite, React, TypeScript, Tailwind, zod. Celá stránka se sestaví do jednoho HTML souboru.
- **Tři buildy z jednoho kódu:**
  - `npm run build` a `npm run build:resitel` dělají stránku pro claude.ai. Clauda volá přes účet toho, kdo ji otevře, bez serveru a bez klíče.
  - `npm run build:web` dělá veřejný web na Vercelu se serverovými funkcemi v `api/` a `server/`.
- **Role jsou konfigurace, ne kód.** Zadání, podklady, rubrika, úrovně a cvičení jsou v `data/roles/*.json`. Obě role běží stejným kódem.
- **Prompty** asistenta a hodnotitele jsou v `docs/PROMPTS.md`. Test hlídá, že kód používá doslova stejný text.

## Bezpečnost

- API klíč je jen v nastavení serveru. Do prohlížeče, repozitáře ani buildu se nedostane a build to při každém sestavení kontroluje.
- Pokyny pro asistenta i hodnotitele skládá server. Prohlížeč posílá jen zprávy uživatele.
- Klíč se záludnostmi dostane jen hodnotitel, nikdy asistent.
- Denní limity na osobu i celkem (počítadla v Upstash Redis), takže útrata má strop.
- Server přijímá požadavky jen z vlastní stránky.
- Ochrana proti prompt injection: text uživatele nemůže v pokynech hodnotitele předstírat systémové značky.
- Content Security Policy s hashem skriptu, zákaz vložení stránky do cizího webu a odpovědi serveru bez ukládání do mezipaměti.

Podrobný plán produkční verze, včetně nákladů a rizik, je v `docs/PRODUCTION.md`.

## Spolehlivost hodnotitele

Hodnotitel se kalibruje na vymyšlených bězích od slabého po silný. Každý běh se ohodnotí třikrát a musí platit:

- pořadí běhů je ve všech kolech stejné,
- stav záludností odpovídá záměru běhu,
- celková úroveň stejného běhu kolísá nejvýš o jednu.

## Spuštění

Potřebuješ Node.js ve verzi LTS.

```bash
npm install
npm run dev
```

Na `http://localhost:5173` běží stránka v náhledu bez AI. Adresa `http://localhost:5173/?simulace` nahradí Clauda vymyšlenými odpověďmi, takže si projdeš celý postup bez klíče a bez útraty.

```bash
npm test
```

Testy hlídají výpočet úrovně, kontrolu citací, platnost konfigurace rolí, shodu promptů s dokumentací, limity a serverové funkce.

## Co v této kopii záměrně není

Tohle je veřejná kopie soukromého repozitáře. Chybí v ní:

- klíče hodnotitele se záludnostmi,
- ukázková a kalibrační hodnocení,

protože by prozradily řešení lidem, kteří si úkol teprve zkusí. Testy, které je potřebují, se tu proto přeskočí, a hodnocení na vlastním serveru bez klíčů neproběhne. Celé to vyzkoušíš na [živé verzi](https://role-lab-gamma.vercel.app).

## Jak to vzniklo

Nejsem vývojář. Role Lab jsem postavil tak, že jsem řídil Claude Code: zadával jsem, posuzoval výsledky a rozhodoval. Pravidla té spolupráce jsou v `CLAUDE.md`, zadání a milníky v `docs/SPEC.md`.

**Ondřej Vrabeľ** · [LinkedIn](https://www.linkedin.com/in/ondrej-vrabel/) · Built with Claude Code
