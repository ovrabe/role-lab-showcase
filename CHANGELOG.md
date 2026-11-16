# Co je nového

Přehled změn v každé verzi Role Lab. Formát vychází z Keep a Changelog, verze se číslují podle sémantického verzování: oprava zvýší poslední číslo, nová funkce prostřední, zásadní změna první.

## 1.6.1 – 16. 11. 2026

Kratší úvod.

### Změněno

- Úvodní banner je nižší a má jednu větu, takže role jsou vidět hned na první obrazovce.
- Denní výzva je na jednom řádku a odkaz „Všechny výzvy“ je vedle ní.
- Role jsou na telefonu jako řádky v jednom panelu, na počítači jako karty ve třech sloupcích s krátkým popisem.
- U každé role je počet úkolů a jejich délka, třeba „3 úkoly · 15–45 min“.
- Role Research Associate v mikrobiologii se jmenuje Molekulární biolog.

## 1.6.0 – 16. 11. 2026

Role Controller.

### Přidáno

- Nová role Controller s úkolem „Odchylky od rozpočtu za říjen“ (obtížnost 1, asi 15 minut), zkalibrovaná na slabém, středním a silném pokusu.
- Pod seznamem rolí je odkaz „Chybí ti tvoje role? Napiš autorovi“. Návrh dorazí autorovi do seznamu námětů.

### Změněno

- Sekce „Připravujeme“ zmizela, všechny ohlášené role už jsou v aplikaci.
- Odkaz na zpětnou vazbu v patičce je česky: „Napsat autorovi“.

## 1.5.0 – 16. 11. 2026

Zpětná vazba na jednom místě.

### Přidáno

- Testovací scénář přímo v aplikaci (odkaz s `?testovani` na konci adresy). Tester projde sedm kroků a odpovědi odešle jedním tlačítkem. Rozpracované odpovědi se pamatují v prohlížeči.
- Zprávy autorovi, odpovědi testerů a nesouhlas s hodnocením se ukládají do jednoho soukromého seznamu námětů.

### Změněno

- Ve formuláři zpětné vazby je nepovinný e-mail s vysvětlením, k čemu slouží: autor dá vědět, jak s námětem naložil.
- Prohlídka si pamatuje, kde skončila. Po návratu z denní výzvy nezačíná znovu a dá se spustit od začátku tlačítkem Začít znovu.
- Texty původních rolí a úkolů jsou genderově neutrální.

## 1.4.0 – 16. 11. 2026

Šest nových rolí.

### Přidáno

- Nové role, každá zatím s jedním úkolem obtížnosti 1 (asi 15 minut):
  - AI tech lead: Model pro třídění požadavků
  - Recruiter: Kandidáti do druhého kola
  - Marketér: Vítězná varianta landing page
  - IT helpdesk: Ranní fronta požadavků
  - QA: Vydat verzi 3.8?
  - Research Associate v mikrobiologii: Citlivost izolátu na ciprofloxacin
- Každý nový úkol má vlastní rubriku, vymyšlená data se záludností a je zkalibrovaný na slabém, středním a silném pokusu.
- Stránka O projektu ukazuje výsledky kalibrace všech dvanácti úkolů.

### Opraveno

- Na širokém displeji se panel asistenta při posouvání stránky už nepřesouvá přes Odevzdání.
- Neúplné hodnocení bez shrnutí se nezobrazí. Místo něj nabídne aplikace Zkusit znovu.
- Hodnotitel píše neutrálně i tam, kde dřív používal tvary jako „sám“ nebo „jistý“.

## 1.3.0 – 15. 11. 2026

Prohlídka na dvě minuty.

### Přidáno

- Prohlídka pro každého, kdo chce vidět, jak Role Lab funguje, než se pustí do úkolu. Na vymyšleném příkladu s kávou do předplatného projdeš zadání, rozhovor s asistentem, odevzdání a hodnocení.
- V rozhovoru klikáš na připravené zprávy a vysvětlivky ukazují, na co se dívat. AI v něm udělá chybu a uvidíš, jak ji odhalit.
- Hodnocení na konci vypadá stejně jako po skutečném úkolu, včetně citací a režimu hodnotitele.
- Prohlídka nevolá AI, nic neukládá a nepočítá se do limitu. Otevřeš ji tlačítkem „Prohlídka na 2 minuty“ na úvodu nebo odkazem s `?prohlidka` na konci adresy.

## 1.2.2 – 15. 11. 2026

### Změněno

- Šipky zpět a vpřed se v hlavičce ukážou, jen když je kam jít. Na úvodní stránce tedy nepřekážejí.
- Na webu funguje i tlačítko zpět v prohlížeči a gesto zpět na telefonu: vrací na předchozí obrazovku a z aplikace neodvede.
- Přepínač vzhledu je jedna ikona, která otevře malou nabídku se třemi možnostmi.
- Profil v hlavičce je jen ikona, popisek „Můj profil“ se ukáže po najetí myší.

## 1.2.1 – 15. 11. 2026

### Změněno

- Hlavička funguje jako v prohlížeči: šipky zpět a vpřed vracejí na předchozí obrazovku, takže se nemusíš vracet přes úvod.
- Název Role Lab je uprostřed hlavičky a vede na úvod.
- Profil má větší ikonu a na počítači i popisek „Můj profil“. Přepínač vzhledu je od profilu oddělený.
- Ve verzi pro claude.ai jsou ukázková hodnocení i pro čtyři nové úkoly.

## 1.2.0 – 15. 11. 2026

Tři obtížnosti v každé roli.

### Přidáno

- Každá role má teď tři úkoly: obtížnost 1 (základní, asi 15 minut), 2 (střední, původní úkol) a 3 (pokročilá, asi 45 minut s více podklady, které je potřeba dát dohromady).
- Category manager: nové úkoly „Hlavní tip do newsletteru“ a „Objednávka zboží na Black Friday“.
- Projektový manažer: nové úkoly „Čerpání rozpočtu pro finanční ředitelku“ a „Rozhodnutí o spuštění 2. 11.“.
- Po výběru role se ukážou její úkoly s obtížností, stavem a nejlepší dosaženou úrovní.
- Úkol obtížnosti 3 se odemkne, když v úkolu obtížnosti 2 téže role dosáhneš úrovně 3 (Pracuje s AI).

### Změněno

- Hlavička úkolu a historie pokusů v profilu ukazují i název úkolu, nejen roli.
- Stránka O projektu ukazuje výsledky kalibrace hodnotitele pro všech šest úkolů.

## 1.1.1 – 15. 11. 2026

### Opraveno

- Výzva „Text na web je mimo“ se teď jmenuje „Popis aplikace na web“. V kartě výzvy dne původní název vypadal jako chybová hláška.

## 1.1.0 – 15. 11. 2026

Krátké výzvy na každý den.

### Přidáno

- 15 krátkých výzev, tři na každou z pěti dovedností. Každá má situaci, výstup AI a úkol, na který napíšeš jednu odpověď. Hodnocení přijde za pár sekund, skóre je doložené citacemi z odpovědi a ukáže se i rozbor toho, co výzva skrývala.
- Výzva dne na úvodu. Je stejná pro všechny a každý den jiná.
- Mapa výzev s nejlepším skóre u každé výzvy. Výsledky výzev se ukládají jen v tomto prohlížeči a úroveň dovedností v profilu nemění, tu určují celé úkoly.

### Bezpečnost

- Webová verze: výzvy hodnotí rychlejší model na serveru a klíč výzvy prohlížeč dostane až s hodnocením.
- Webová verze: vlastní denní limit pro výzvy na osobu i celkem.

## 1.0.0 – 14. 11. 2026 · MVP

První veřejná verze.

### Přidáno

- Dvě role, category manager a projektový manažer, každá s realistickým pracovním úkolem a podklady.
- Chat s AI asistentem: přiložení podkladů, zastavení odpovědi a kopírování odpovědi do schránky.
- Hodnocení v pěti oblastech: zadání a kontext, rozklad úkolu, ověřování, iterace a úsudek. Každé skóre je doložené citací ze záznamu a celkovou úroveň počítá kód podle pravidel role.
- Po odevzdání rozbor záludností v datech a doporučená cvičení na nejslabší oblasti.
- Můj profil: pokrok v pěti dovednostech, 20 odznaků, historie pokusů a vlastní ikona. Ukládá se jen v tomto prohlížeči.
- Zpětná vazba k hodnocení a tlačítko Share feedback (webová verze).
- Stránky Jak hodnotíme a O projektu.

### Bezpečnost

- Webová verze: API klíč, pokyny hodnotitele i popis záludností zůstávají na serveru.
- Denní limity na osobu i celkem, požadavky jen z vlastní stránky.
- Ochrana proti vnuceným instrukcím v chatu a Content Security Policy.
