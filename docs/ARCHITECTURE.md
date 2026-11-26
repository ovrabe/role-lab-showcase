# Architektura

Role Lab běží ve dvou podobách z jednoho kódu. Veřejná webová verze má vlastní server na Vercelu. Verze v claude.ai je jeden HTML soubor bez serveru, který volá Clauda přes účet toho, kdo stránku otevře. Schémata níž GitHub vykreslí sám (Mermaid). Přehledové schéma v README jsou obrázky `docs/architecture-light.svg` a `docs/architecture-dark.svg`. Kreslí je `node scripts/build-architecture-diagram.mjs`, po změně infrastruktury je potřeba upravit obojí.

## Webová verze

[role-lab-gamma.vercel.app](https://role-lab-gamma.vercel.app), sestavuje ji `npm run build:web`.

```mermaid
flowchart LR
    browser["Prohlížeč<br/>stránka Role Lab<br/>pokrok a odznaky v localStorage"]

    subgraph vercel["Vercel"]
        page["Statická stránka<br/>jeden index.html<br/>s Content Security Policy"]
        chat["/api/chat"]
        evaluate["/api/evaluate<br/>/api/why, /api/example"]
        challenge["/api/challenge"]
        feedback["/api/feedback<br/>/api/stats"]
        custom["/api/custom-task<br/>-status, -share"]
        content["Podklady, pokyny<br/>a klíče hodnotitele<br/>jen na serveru"]
    end

    anthropic["Anthropic API<br/>asistent a generátor vlastní výzvy: Claude Sonnet<br/>hodnotitel: Claude Opus<br/>výzvy a vysvětlení skóre: Claude Haiku"]
    upstash["Upstash Redis<br/>denní limity a rozpočet<br/>anonymní denní součty na 90 dní<br/>vlastní výzvy na 30 dní"]
    github["GitHub Issues<br/>zpětná vazba, statistika,<br/>žádosti o sdílení, upozornění"]
    botid["Vercel BotID<br/>člověk, nebo robot"]

    browser -- "načtení" --> page
    browser -- "zprávy a ID podkladů" --> chat
    browser -- "záznam a výsledek" --> evaluate
    browser -- "krátká výzva" --> challenge
    browser -- "zpětná vazba, statistika" --> feedback
    browser -- "popis a struktura tabulky" --> custom
    content -. "skládá pokyny" .-> chat & evaluate & challenge
    chat & evaluate & challenge & custom --> anthropic
    chat & evaluate & challenge & feedback & custom --> upstash
    feedback & custom --> github
    browser -. "skript BotID přes vlastní doménu" .-> botid
    chat & evaluate & challenge & feedback & custom -. "verdikt" .-> botid
```

- **API klíč** k Anthropicu je jen v nastavení Vercelu. Do prohlížeče ani do repozitáře se nedostane.
- **Pokyny a klíč hodnotitele** skládá server. Prohlížeč posílá jen zprávy uživatele a ID podkladů. Asistent klíč nikdy nedostane.
- **Rozbor záludností** pošle server prohlížeči až s výsledkem hodnocení.
- **Celkovou úroveň** počítá kód podle konfigurace role a ověřuje, že citace v záznamu opravdu jsou.
- **Limity** se počítají pro každou osobu i celkem a nulují se každý den o půlnoci pražského času. Osoba je náhodné číslo, které si uloží prohlížeč. Jedna IP adresa má navíc strop zhruba čtyř lidí a ukládá se jen jako otisk, ne samotná adresa.
- **Server** přijímá požadavky jen z vlastní stránky.
- **Ochrana proti robotům** (Vercel BotID, od verze 2.7.0): stránka přidá ke každému volání AI, zpětné vazbě a vlastní výzvě podpis a server se Vercelu zeptá, jestli ho poslal člověk. Zatím jen zapisuje verdikt do anonymních denních součtů a nic neblokuje (`docs/PRODUCTION.md`, oddíl 3). Statistika `/api/stats` se neověřuje, posílá se i při zavírání karty.
- **Písmo** je od verze 2.6.0 z vlastní domény. Z cizích webů stránka nenačítá nic.
- **Vlastní výzva** (beta): prohlížeč pošle popis role a situace a z tabulky jen strukturu, hodnoty z ní neopustí prohlížeč. Server vygeneruje úkol, ověří, že záludnost je v datech, a uloží ho na 30 dní pod náhodným id. Klíč k záludnosti zůstává na serveru. E-maily, rodná čísla a čísla účtů odmítne stránka i server. Sdílení s kolegy schvaluje autor příkazem `npm run custom-task`, který umí generování i vypnout.

## Verze v claude.ai

Ukázková (`npm run build`) a pro řešitele (`npm run build:resitel`), publikované jako artefakty v claude.ai.

```mermaid
flowchart LR
    viewer["Prohlížeč<br/>člověk přihlášený v claude.ai"]

    subgraph claudeai["claude.ai"]
        artifact["Artefakt Role Lab<br/>jeden HTML soubor<br/>podklady, pokyny i klíče uvnitř"]
        sample["claude.use('sample')"]
    end

    account["Claude<br/>na účet toho,<br/>kdo stránku otevřel"]

    viewer -- "otevře odkaz" --> artifact
    artifact -- "chat a hodnocení" --> sample
    sample --> account
```

- Žádný server, API klíč ani databáze. Útratu nese účet toho, kdo stránku používá.
- Bez serveru musí být klíč hodnotitele uvnitř stránky. Proto je pro veřejnost hlavní webová verze.
- Verze pro řešitele vynechává kalibraci a ukázková hodnocení, které záludnosti rozebírají.

## Vývoj a vydání

```mermaid
flowchart LR
    dev["Počítač autora<br/>Claude Code, npm test"]
    private["GitHub: role-lab<br/>soukromý, celý projekt"]
    vercelDeploy["Vercel<br/>build:web a nasazení"]
    artifacts["claude.ai<br/>dva artefakty"]
    showcase["GitHub: role-lab-showcase<br/>veřejná kopie bez klíčů<br/>a ukázkových hodnocení"]

    dev -- "git push" --> private
    private -- "každý push na main" --> vercelDeploy
    dev -- "npm run build a build:resitel,<br/>publikace" --> artifacts
    dev -- "scripts/export-public.mjs" --> showcase
```

Přehled změn v každé verzi je v `CHANGELOG.md`.
