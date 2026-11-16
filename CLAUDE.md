# Role Lab

Prototyp, který hodnotí, jak člověk pracuje s AI na realistickém pracovním úkolu typickém pro danou roli. Člověk řeší úkol s AI asistentem, stránka zaznamená postup a druhé volání Clauda ho ohodnotí podle rubriky. Každé skóre je doložené citací a člověk ho může upravit.

Výsledkem je **jedna samostatná HTML stránka**, kterou autor publikuje v claude.ai. Clauda volá přes účet toho, kdo stránku otevře. **Žádný server, žádný API klíč, žádný `.env`.**

## Zdroje pravdy

- `docs/SPEC.md` — co stavíme, rozsah, milníky, design
- `docs/PROMPTS.md` — pokyny pro asistenta a hodnotitele, výstupní schéma, výpočet úrovně
- `docs/RUNTIME.md` a `docs/claude-runtime/*.d.ts` — jak stránka volá Clauda. Soubory `.d.ts` mají přednost před tvou pamětí.
- `docs/DEMO.md` — jak prototyp ukázat za tři minuty
- `docs/PRODUCTION.md` — plán produkční (webové) verze, bezpečnost API klíče, náklady
- `data/roles/*.json` — konfigurace rolí: rubrika, úrovně, strop, mikro-cvičení
- `data/tasks/*.json` — úkoly rolí: zadání, seznam podkladů, obtížnost 1–3
- `data/challenges/*.json` — krátké výzvy na jednotlivé dovednosti
- `data/<role>/` — podklady k úkolům každé role
- `evaluator-data/*.key.json` — klíče hodnotitele k úkolům, `evaluator-data/challenges/*.key.json` k výzvám

Rolí je devět: category manager a projektový manažer (každá se třemi obtížnostmi), od verze 1.4.0 AI tech lead, recruiter, marketér, IT helpdesk, QA a research associate v mikrobiologii a od verze 1.6.0 controller (zatím s úkolem obtížnosti 1). Kód nesmí mít nic natvrdo pro jednu roli.

Tyto soubory neměň bez mého souhlasu. Když narazíš na rozpor mezi nimi, zeptej se.

## Stack

Vite, React, TypeScript, Tailwind zkompilovaný při sestavení, zod, `vite-plugin-singlefile`. `npm run dev` pro vývoj, `npm run build` vytvoří jeden soubor `dist/index.html`.

## Pevná pravidla

- **Build pro claude.ai** (`dist/`, `dist-resitel/`): nikdy žádný API klíč, server ani volání `api.anthropic.com`. Jediná cesta ke Claudovi je `claude.use("sample")`.
- **Webový build** (produkční verze, `docs/PRODUCTION.md`): Clauda volá jen serverová funkce. API klíč je jen v nastavení serveru (environment variable), nikdy v kódu, v repozitáři, v `.env` v gitu ani v prohlížeči. Pokyny pro asistenta a hodnotitele i klíč hodnotitele skládá server, prohlížeč posílá jen zprávy uživatele a ID podkladů.
- Mimo claude.ai musí stránka fungovat v náhledovém režimu (viz SPEC, bod 8).
- Asistent nesmí dostat klíč hodnotitele ani vědět o záludnostech. Klíč se posílá jen ve volání hodnotitele a v rozhraní se ukáže až po odevzdání.
- Celkovou úroveň počítá kód podle konfigurace role, ne model.
- Žádné síťové požadavky kromě Google Fonts (a ve webovém buildu vlastní serverové funkce). Build pro claude.ai má všechno uvnitř `dist/index.html`.
- Texty v rozhraní česky, kód a názvy v kódu anglicky.
- Při zakládání projektu zachovej existující složky `docs/`, `data/`, `evaluator-data/`.
- Novou závislost přidej jen tehdy, když ji zdůvodníš.

## Jak se mnou pracovat

Nejsem vývojář. Rozumím produktu a AI, ne detailům kódu.

- Pracuj po milnících z `docs/SPEC.md`. Před každým milníkem mi ukaž krátký plán a počkej na souhlas.
- Po každém milníku se zastav a česky mi napiš: co je hotové, co mám spustit nebo otevřít a co mám otestovat.
- Když milník potřebuje test v claude.ai, řekni mi to a připomeň, že mám nahrát `dist/index.html` k publikaci (postup v `NAVOD.md`).
- Když něco nejde podle specifikace, řekni to rovnou a navrhni nejjednodušší řešení.
- Neříkej, že je něco hotové, dokud to neběží. Když něco neověříš, napiš, že to ověřené není.
