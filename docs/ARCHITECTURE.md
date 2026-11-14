# Architektura

Role Lab běží ve dvou podobách z jednoho kódu. Veřejná webová verze má vlastní server na Vercelu. Verze v claude.ai je jeden HTML soubor bez serveru, který volá Clauda přes účet toho, kdo stránku otevře. Schémata níž GitHub vykreslí sám (Mermaid).

## Webová verze

[role-lab-gamma.vercel.app](https://role-lab-gamma.vercel.app), sestavuje ji `npm run build:web`.

```mermaid
flowchart LR
    browser["Prohlížeč<br/>stránka Role Lab<br/>pokrok a odznaky v localStorage"]

    subgraph vercel["Vercel"]
        page["Statická stránka<br/>jeden index.html<br/>s Content Security Policy"]
        chat["/api/chat"]
        evaluate["/api/evaluate"]
        feedback["/api/feedback"]
        content["Podklady, pokyny<br/>a klíče hodnotitele<br/>jen na serveru"]
    end

    anthropic["Anthropic API<br/>asistent: Claude Sonnet<br/>hodnotitel: Claude Opus"]
    upstash["Upstash Redis<br/>denní limity, osoba = otisk IP<br/>zpětná vazba"]
    fonts["Google Fonts"]

    browser -- "načtení" --> page
    browser -- "zprávy a ID podkladů" --> chat
    browser -- "záznam a výsledek" --> evaluate
    browser -- "zpětná vazba" --> feedback
    content -. "skládá pokyny" .-> chat & evaluate
    chat & evaluate --> anthropic
    chat & evaluate & feedback --> upstash
    browser -.-> fonts
```

- **API klíč** k Anthropicu je jen v nastavení Vercelu. Do prohlížeče ani do repozitáře se nedostane.
- **Pokyny a klíč hodnotitele** skládá server. Prohlížeč posílá jen zprávy uživatele a ID podkladů. Asistent klíč nikdy nedostane.
- **Rozbor záludností** pošle server prohlížeči až s výsledkem hodnocení.
- **Celkovou úroveň** počítá kód podle konfigurace role a ověřuje, že citace v záznamu opravdu jsou.
- **Limity** se počítají pro každou osobu i celkem a nulují se každý den o půlnoci pražského času. Osoba je jen otisk IP adresy, ne samotná adresa.
- **Server** přijímá požadavky jen z vlastní stránky.

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
