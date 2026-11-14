# Role Lab — specifikace prototypu

## 1. Proč to vzniká

Firmy zavádějí povinné AI dovednosti a potřebují je hodnotit. Test znalostí ukáže, co člověk o AI ví. Neukáže, jak s ní pracuje.

Role Lab hodnotí práci s AI na realistickém pracovním úkolu typickém pro danou roli. Člověk řeší úkol s AI asistentem, aplikace zaznamená celý postup a hodnotitel (jiný model) posoudí výsledek i způsob práce. Každé skóre je doložené citací. Konečné slovo má člověk.

Princip v jedné větě: **AI úkol provází, hodnotí a doporučuje další krok; člověk hodnocení kalibruje, protože může ovlivnit něčí rozvoj.**

## 2. Pro koho

- **Zaměstnanec** projde úkol a dostane výsledek s důkazy a jedním až dvěma konkrétními dalšími kroky.
- **Hodnotitel z L&D nebo vedoucí** vidí stejný výsledek, může upravit skóre a přidat poznámku a exportuje JSON.

## 3. Rozsah MVP

Uvnitř:
- Dvě role naplno. Category manager (pánské vůně) se staví první. Projektový manažer (převzatý projekt před řídicím výborem) se přidává v M4 jako důkaz, že nová role je jen konfigurace.
- Obrazovky: úvod, úkol s asistentem, vyhodnocení, výsledek, režim hodnotitele, Jak hodnotíme.
- Záznam práce, hodnocení, výpočet úrovně, rozbor záludností po skončení, export.
- Kalibrační panel pro autora (M3.5).

Mimo MVP:
- Server, API klíč, databáze a účty. Aplikace je jedna samostatná HTML stránka publikovaná v claude.ai. Průběh se drží v prohlížeči (localStorage), výsledek se exportuje.
- Další role. Architektura je připravená: role = jeden JSON, jeden klíč hodnotitele a její podklady.
- Souhrnný přehled pro L&D.

## 4. Uživatelský tok

1. **Úvod.** Výběr role. Aktivní jsou category manager a projektový manažer, ostatní (recruiter, controller, marketér, vedoucí týmu) jsou vidět jako připravované.
2. **Úkol.** Zadání, záložka Podklady, asistent, pole pro odevzdání s počítadlem znaků (max 2 500) a nepovinné pole „Komentář k postupu" (bez lomítek v rodě, stejný název má i v záznamu práce). Podklady se zobrazují podle typu: CSV jako tabulka se slovníkem sloupců, Markdown jako text. U každého podkladu je stažení a tlačítko „Přiložit do konverzace". Měkký časovač 30 minut: po uplynutí jen upozorní, nic nezablokuje.
3. **Odevzdání.** Potvrzovací krok, pak vyhodnocení se stavem načítání (může trvat desítky sekund).
4. **Výsledek.**
   - Úroveň a jednovětné shrnutí.
   - Pět dimenzí: skóre 1 až 4, odůvodnění, citace. Kliknutí na citaci posune záznam na daný krok a citaci v něm zvýrazní.
   - Záludnosti v datech: po skončení se odhalí, co v datech bylo, a zda to člověk zachytil. Tahle část má učit, ne soudit.
   - Silné stránky a jeden až dva další kroky s mikro-cvičením.
   - Jistota hodnocení a příznaky pro lidskou kontrolu.
   - Věta: „Hodnocení navrhla AI. Konečné slovo má člověk."
   - Tlačítka: Stáhnout výsledek (JSON), Otevřít v režimu hodnotitele.
5. **Režim hodnotitele** (přepínač v patičce výsledku; bez hesla, přístup řídí sdílení stránky v claude.ai). Změna skóre po dimenzích, poznámka, přepočet úrovně stejnou funkcí, export s původním i upraveným skóre.
6. **Jak hodnotíme.** Rubrika, výpočet úrovně včetně stropu, co asistent dělá a nedělá, co se ukládá (nic mimo prohlížeč) a že volání Clauda jde z účtu toho, kdo stránku otevřel.

## 5. Role a podklady

Každá role má tři části:

- `data/roles/<role>.json` — zadání, seznam podkladů, rubrika, úrovně, strop, mikro-cvičení. Veřejné.
- `data/<role>/…` — podklady k úkolu. Veřejné, uživatel si je čte a stahuje.
- `evaluator-data/<role>.key.json` — klíč hodnotitele: záludnosti, přijatelné odpovědi, spočítaná fakta. Při sestavení se vloží do stránky, ale nikdy se nezobrazí v rozhraní před odevzdáním a nikdy se nepošle asistentovi. Posílá se jen ve volání hodnotitele.

**Omezení, které přijímáme vědomě:** bez serveru nejde klíč hodnotitele skrýt. Kdo otevře zdrojový kód stránky, záludnosti najde. Pro předvedení to nevadí. Pro ostré hodnocení lidí by byl potřeba server a to je mimo MVP.

Role v MVP:

- **Category manager** — `prodeje_panske_vune_cz.csv`: 145 řádků, 12 produktů, 12 týdnů, syntetická data s vymyšlenými značkami.
- **Projektový manažer** — `ukoly_export.csv` (27 úkolů), dva týdenní statusy a zápis ze schůzky s dodavatelem, vše v Markdownu.

V podkladech každé role jsou záludnosti popsané v klíči. Asistent o nich neví a sám je nehledá; hodnotí se, jestli se na ně člověk zeptá.

Rubrika je veřejná a na stránce Jak hodnotíme ji uvidí každý. Kdo ví, že se hodnotí ověřování, bude ověřovat, a to je v pořádku: hodnotí se, jestli to umí, ne jestli si na to vzpomene. Počet ani povahu záludností ale rozhraní neprozrazuje až do výsledku.

## 6. Záznam práce

Každá položka záznamu:

```ts
type TranscriptItem = {
  turn: number;            // od 1, průběžně
  kind: "user" | "assistant" | "event";
  content: string;         // u událostí krátký popis
  event?: "task_opened" | "material_viewed" | "material_downloaded" | "data_attached" | "submission_saved" | "submitted";
  materialId?: string;     // u událostí s podkladem
  ts: string;              // ISO čas
};
```

Záznam i rozpracované odevzdání se průběžně ukládá do localStorage, aby se po obnovení stránky nic neztratilo. Tlačítko „Začít znovu" záznam smaže.

## 7. Hodnocení

- Rubrika, úrovně, strop a mikro-cvičení jsou v konfiguraci role.
- Prompty a výstupní schéma jsou v `docs/PROMPTS.md`.
- Hodnotitel vrací skóre dimenzí, stav záludností, důkazy a další kroky. **Celkovou úroveň počítá kód** (průměr, prahy, strop). Díky tomu jsou pravidla průhledná a úroveň se nemění s náladou modelu.
- Po validaci schématu kód ověří, že citace skutečně existují v záznamu nebo v odevzdání. Neexistující citace se v UI označí a přidá se příznak pro lidskou kontrolu.

## 8. Architektura a bezpečnost

- **Výstup:** jeden samostatný soubor `dist/index.html`, všechno uvnitř (JS, CSS, data rolí, klíče hodnotitele). Nejvýš 16 MB.
- **Stack:** Vite, React, TypeScript, Tailwind zkompilovaný při sestavení, zod, `vite-plugin-singlefile`. Žádný server, žádný `.env`, žádný API klíč.
- **Volání Clauda:** přes funkci `sample` z prostředí claude.ai. Přesné rozhraní je v `docs/claude-runtime/sample.d.ts` a `claude.d.ts`, shrnutí v `docs/RUNTIME.md`. Nic si nedomýšlej nad rámec těchto souborů.
- **Kdo platí:** volání jde z účtu člověka, který stránku otevřel. Při prvním volání ho claude.ai požádá o souhlas.
- **Omezení publikované stránky:** externí skripty jen z cdnjs.cloudflare.com, cdn.jsdelivr.net, cdn.tailwindcss.com a code.jquery.com; styly jen z Google Fonts. Žádné jiné síťové požadavky, žádné vzdálené obrázky. Nejjednodušší je nemít žádné externí skripty a písma načíst z Google Fonts s náhradní sadou písem.
- **localStorage** v publikované stránce funguje. Každé čtení i zápis obal do try/catch a počítej s tím, že je prázdný.
- **Náhledový režim:** mimo claude.ai (`npm run dev`, otevřený soubor) `window.claude` neexistuje. Aplikace to pozná hned při startu a přepne se do náhledu: v hlavičce vedle názvu malá pilulka „Náhled bez AI“, která po ťuknutí ukáže vysvětlení (dřív to byl žlutý pruh přes celou šířku), asistent odpoví pevnou větou, že v náhledu neodpovídá, a tlačítko Vyhodnotit načte ukázkové hodnocení z `fixtures/`. Všechno ostatní funguje normálně.
- **Uvnitř claude.ai:** `await claude.use("sample")` může vrátit `null`. Pak se chová jako náhled. Chybu `not_granted` ber jako „člověk nepovolil“ a řekni mu, co to znamená.
- **Limity:** 25 zpráv uživatele na session. Nikdy nevolej `sample` ve smyčce ani automaticky při načtení.
- **Obrazovka a mobil:** v `<head>` meta viewport s `viewport-fit=cover`, okraje přes `env(safe-area-inset-*)`, barvy jako proměnné na `:root` včetně tmavého režimu (`prefers-color-scheme` a `data-theme`).
- Obsah konverzace zpracovává Claude přes účet uživatele. Na stránce Jak hodnotíme upozorni, ať lidé nevkládají skutečná firemní ani osobní data.

## 9. Design

Nástroj má působit lehce, vzdušně a důvěryhodně. Hodnocení nesmí ponižovat.

**Jedna zapamatovatelná věc:** citace ve výsledku a v záznamu vypadají jako zvýraznění fixou, s odkazem na okraji k dimenzi, ke které patří. Ve výsledku je to jediný výrazný prvek.

Styl je inspirovaný systémem ColorOS 17: hodně bílé, měkké pastelové přechody v pozadí, bílé karty s velkým zaoblením a jemným rozptýleným stínem, kulatá plovoucí tlačítka s ikonou, přepínače a štítky ve tvaru pilulky. Bereme styl, ne značku: žádné logo ani názvy OPPO. Předchozí střídmý styl (šedé pozadí, karty bez stínu) byl nahrazen v listopadu 2026, protože působil jako obyčejná webová stránka.

**Lehké je okolí, pevné je čtení.** Pastelové pozadí, úvodní banner a matné sklo patří jen okolí obsahu. Jedinou výjimkou je úvodní banner: nadpis, krátký úvodní text a odkaz Jak hodnotíme leží bíle na jeho tmavé části, barevné tvary zůstávají vpravo a dole mimo text. Všechno, co se čte (zadání, data, chat, citace, hodnocení), leží na pevné neprůhledné ploše. Matné sklo (průsvitná plocha s rozostřeným pozadím) mají jen hlavička a plovoucí prvky.

Barvy (světlý režim; tmavý režim má vlastní odstíny v `src/index.css`):
- inkoust `#1F2A3A` — text
- papír `#F7F7FB` — základ pozadí
- pastelový přechod pozadí: růžová `#FBE6F0`, levandulová `#ECE8FA`, světle modrá `#E4EDFB` — nízká sytost, text na něm nesmí ztratit kontrast
- plocha `#FFFFFF` — karty a panely
- sklo: bílá s 65 % krytím a rozostřením 20 px — hlavička a plovoucí prvky
- barevný přechod pro AI a úvod: oranžová `#FF7A45`, růžová `#E5489B`, fialová `#8A5CF6`, modrá `#3D7BFF` na tmavě fialovém podkladu `#2B2266` — jen úvodní banner, ikona asistenta, ikony rolí, barevné kroužky ikon v zadání a tlačítko odevzdání
- data a postup: fialová do indigové. Přechod `#8A5CF6` → `#5B6CFF` mají jen grafy (prstenec celkové úrovně, pruhy pěti oblastí) a fajfky postupu; plnou fialovou `#5B52F0` (v tmavém režimu `#A49BFF`; drží kontrast 5:1 i pro malá čísla) mají tečky skóre, čísla stupnic v rubrice a úrovních a ikony v Kam dál. Velká čísla (úroveň, skóre u pruhů) jsou tmavá jako text. Prázdná část grafů `#EFEEF7`. Přechod je u každé hodnoty stejný, liší se jen délka, takže barva nic nehodnotí.
- fix `#FFE58A` — zvýraznění citací
- tlačítka: tmavá pilulka `#1F2A3A` s bílým textem (v tmavém režimu světlá `#F2F4F8` s tmavým textem); jedinou výjimkou je odevzdání výsledku, které má barevný přechod AI v tmavší variantě (`#CF4520` → `#C8327F` → `#7A4EF0` → `#3366E0`, bílý text má všude kontrast aspoň 4,5:1) s bílým tučným textem — je to jediná klíčová akce úkolu
- tmavě modrá `#1D4A9E` — odkazy, fokus, vybraná záložka, časovač a počítadlo znaků; na tlačítka ani na data se nepoužívá

Tvary: tři velikosti zaoblení pro celou aplikaci — karty a panely 24 px, vnitřní prvky (pole, dlaždice, tabulky, upozornění) 16 px, drobnosti (výběr, řádek záznamu) 10 px; tlačítka, štítky a přepínače jako pilulka, ikonová tlačítka kulatá. Rohy jsou plynulé jako u Applu (squircle, CSS `corner-shape`) tam, kde to prohlížeč umí, a poloměry jsou pak o polovinu větší, protože squircle při stejném poloměru působí menší; jinde zůstanou obyčejně kulaté. Poloměry jsou proměnné v `src/index.css`, nikde jinde se nepíší čísly. Stín karet velmi jemný (rozptýlený, krytí kolem 6 %), plovoucí prvky o něco výraznější.

Nízké skóre nikdy červeně ani oranžově. Úrovně a skóre mají jednu barvu (fialovou), ne semafor; teplý barevný přechod AI se u skóre nepoužívá. Záludnost, kterou člověk nezachytil, je šedá a neutrální.

Písmo: Plus Jakarta Sans z Google Fonts (řezy 400, 500, 600), zvolené jako nejbližší volně dostupná náhrada písma ColorOS. Má české znaky. Když se nenačte, stránka použije systémové písmo zařízení (SF na Applu, Segoe UI na Windows, Roboto na Androidu) a nic se nerozbije. Jedna stupnice velikostí: nadpis stránky 30 px (na telefonu 24 px), nadpis sekce 20 px, nadpis karty 18 px, běžný text 16 px, vedlejší text 14 px, drobné popisky (čísla tahů, kdo mluví, odkaz u citace) 12 px. Jediná výjimka je název úrovně ve výsledku, 30 px. 14 px jen pro vedlejší údaje (počítadla, časovač, popisek pod nadpisem, tabulka dat, malá tlačítka, patička); vysvětlující věty, upozornění a chybové hlášky mají běžných 16 px. Řádkování 1,63 všude kromě chatu a tabulky dat, které jsou hustší. V tabulce dat `font-variant-numeric: tabular-nums`. Ověř, že se správně vykreslí ě š č ř ž ý á í é ů ú ň ť ď.

Rozvržení úkolu: na počítači dva sloupce, vlevo Zadání a Podklady v záložkách, vpravo Asistent, odevzdání jako panel dole. Na telefonu čtyři záložky s ikonou a popiskem v plovoucí skleněné pilulce s odstupem od okrajů displeje (jako v iOS 26 a ColorOS 17); obsah u spodního okraje plynule přechází do barvy pozadí, aby pod lištou nerušil. Lišta má jemný rozptýlený stín, vybranou záložku označuje bílá pilulka, která k ní plynule dojede, ikona vybrané záložky lehce poskočí. Při posouvání dolů lišta zajede, při posunu nahoru se vrátí. Tlačítko Odevzdat zůstává při posouvání po ruce nad lištou.

Orientace v úkolu: záložky jdou použít v libovolném pořadí, úkol ale má přirozený postup. Nahoře v Zadání je karta „Jak postupovat“ se čtyřmi očíslovanými kroky (Přečti zadání, Prohlédni podklady, Pracuj s asistentem, Odevzdej výsledek); kroky se samy odškrtávají podle záznamu a aktuální je zvýrazněný. Karta je jen přehled, nic nepřepíná, aby čtení nikoho nepřehodilo na jinou obrazovku; pod kroky je věta, kde je najde (na telefonu v liště dole zleva doprava). Stejný postup ukazuje lišta: hotová záložka má u ikony malou fajfku ve fialovém přechodu, doporučená další záložka fialovou tečku. Při přepnutí záložky na telefonu nový obsah krátce vyjede ze strany, na které záložka leží (0,3 s). Na konci Zadání je tlačítko „Prohlédnout podklady“, na konci Podkladů „Pracovat s asistentem“. Mezi záložkami se nechodí zpět, šipka „Výběr role“ v hlavičce úkol opouští; rozpracovaný úkol zůstává uložený, po odchodu to krátce oznámí hláška dole a karta role na úvodu má štítek „Rozpracováno“ (po odevzdání „Odevzdáno“).

Hlavička: jeden řádek na obrazovku. Na úvodu a v Jak hodnotíme název Role Lab, v úkolu místo něj kulaté tlačítko se šipkou a textem „Výběr role“. Odkaz Jak hodnotíme je jen v banneru na úvodu. Přepínač vzhledu jsou tři malé ikony (podle systému, světlý, tmavý) vpravo v řádku hlavičky, jen na úvodní obrazovce. Vybraná ikona má bílý podklad. Název motivu se ukáže jen na chvíli (1,6 s) po přepnutí, s myší i po najetí na ikonu; jinak nezabírá místo. Výchozí je podle systému. Zadání a Podklady se přepínají přepínačem ve tvaru pilulky. V chatu má dotaz člověka světlou bublinu vpravo, odpověď asistenta je čistý text bez bubliny se jménem a malou ikonou; pole pro zprávu je velká pilulka. Nad obsahem úkolu je barevná ikona role s názvem a časovač jako ubývající prstenec. Zadání je rozdělené do dlaždic s ikonou v barevném kroužku (Situace, Úkol, Co odevzdáváš, Jak pracovat), podklady jsou karty souboru s ikonou typu, počtem řádků a tlačítky. Pod polem pro výsledek je tenký pruh, který se plní k limitu znaků.

Pohyb: nové zprávy v chatu a dlaždice úkolu jemně vyjedou (0,35 s), „Přemýšlím“ má blikající tečky, časovač a pruh znaků se mění plynule. Při omezeném pohybu v systému se nic nehýbe. Do chatu nepatří hotové návrhy otázek: aplikace hodnotí, jak se člověk ptá, a návrhy by mu to napověděly.

Vyhnout se: matné sklo pod textem, který se čte; barevný přechod na tlačítkách kromě odevzdání, v odstavcích a u skóre; popisky velkými písmeny nad nadpisy, šipky v textu tlačítek, konfety a odznaky, číslování 01/02/03 tam, kde nejde o pořadí; fotografie a obrázky stažené zvenku (grafika je SVG přímo ve stránce).

Texty v rozhraní: česky, věcně, slovesa v tlačítkách („Odevzdat doporučení", „Přiložit data do konverzace"). Chybové hlášky říkají, co se stalo a co s tím.

Kvalita: funguje na šířce 390 px, viditelný fokus pro klávesnici, respektuje omezený pohyb, dostatečný kontrast.

## 10. Milníky

Po každém milníku se zastav, shrň česky, co je hotové, jak to spustit a co otestovat.

**M0 — Základ.** Projekt, sestavení do jednoho souboru, náhledový režim, stránka Jak hodnotíme se statickým textem.
Hotovo, když: `npm run dev` otevře aplikaci s pruhem „Náhled bez AI“, `npm run build` vytvoří jeden soubor `dist/index.html`, který funguje i po otevření dvojklikem, a složky `docs/`, `data/`, `evaluator-data/` zůstaly beze změny.

**M1 — Úkol bez AI.** Úvod, výběr role, obrazovka úkolu category managera se zadáním, podklady a polem pro odevzdání. Záznam událostí a localStorage. Vše řízené konfigurací role, nic natvrdo pro jednu roli.
Hotovo, když: tabulka se dá číst na telefonu, obnovení stránky nic nesmaže.

**M2 — Asistent.** Chat přes `sample` se streamováním, tlačítko Zastavit, přiložení podkladů, limit zpráv, záznam kroků, srozumitelné hlášky pro každý kód chyby.
Hotovo, když: v náhledu se asistent chová podle bodu 8, a po publikaci v claude.ai odpovídá česky, pracuje s přiloženými podklady a sám je neprověřuje. Testuje se až po publikaci (viz `NAVOD.md`).

**M3 — Hodnocení.** Volání hodnotitele přes `sample.json`, validace zod, ověření citací, výpočet úrovně v kódu, obrazovka výsledku se zvýrazněnými citacemi a rozborem záludností.
Hotovo, když: každá dimenze má citaci nebo „nedostatek podkladů“, úroveň odpovídá pravidlům z konfigurace, kliknutí na citaci najde krok v záznamu. V náhledu to jde otestovat na ukázkovém hodnocení.

**M3.5 — Kalibrace hodnotitele.** Tři syntetické záznamy ve `fixtures/`: slabý, střední a silný (liší se tím, jak systematicky člověk postupuje a kolik záludností zachytí). Skrytý panel „Kalibrace“ (otevře se parametrem `?kalibrace` v adrese nebo přepínačem v Jak hodnotíme) spustí hodnocení každého záznamu třikrát, postupně, ne naráz, a vypíše tabulku.
Hotovo, když: pořadí je slabý < střední < silný ve všech bězích, stav záludností odpovídá záměru a celková úroveň mezi běhy kolísá nejvýš o jednu. Když ne, uprav prompt hodnotitele, ne fixtures. Běží jen v publikované verzi a spotřebovává limit autora.

**M4 — Druhá role.** Zapnout projektového manažera. Ideálně bez změny kódu, jen konfigurací. Když kód změnu potřebuje, zobecni ho. Do `fixtures/` přidej slabý a silný záznam pro tuto roli a zkalibruj stejně jako v M3.5.
Hotovo, když: obě role běží stejnou aplikací, podklady v Markdownu se čtou dobře na telefonu, kalibrace projde.

**M5 — Režim hodnotitele a export.** Úprava skóre, poznámka, přepočet, JSON export s původním i upraveným hodnocením. Export jako stažení souboru funguje v náhledu; v publikované stránce běžné stahování nefunguje, tam nabídni zkopírování JSON do schránky.

**M6 — Doladění.** Prázdné a chybové stavy, přístupnost, mobil, README pro lidi (co to je, jak sestavit, jak přidat roli).

## 11. Rizika a otevřené otázky

- **Asistent se může splést ve výpočtech.** Je to realistické a patří to k ověřování. Hodnotitel ale nesmí trestat člověka za chybu, kterou neměl šanci poznat. Je to v promptu; při kalibraci zkontroluj.
- **Rozptyl hodnocení.** Řeší ho výpočet úrovně v kódu, citace a kalibrace. Míra shody mezi AI a lidským hodnotitelem je první metrika, kterou má smysl sledovat.
- **Práce mimo aplikaci.** Kdo řeší úkol v jiném nástroji, má chudý záznam. Hodnotitel to má označit příznakem, ne trestat.
- **Férovost.** Výsledek může ovlivnit rozvoj člověka. Proto důkazy u každého skóre, rozbor po skončení a lidské slovo na konci.
- **Klíč hodnotitele je vidět ve zdrojovém kódu.** Přijato pro předvedení, viz bod 5.
- **Útrata jde z účtu diváka.** Kdo stránku dostane, potřebuje účet v claude.ai a musí volání povolit. Před sdílením mimo svůj účet ověř, jak to vypadá z pohledu jiného člověka.
- **Model nevybíráme přesně,** jen úroveň: asistent `default`, hodnotitel `complex`. Když tarif diváka úroveň nemá, platforma použije nižší; aplikace to zobrazí (`modelTierApplied`).

## 12. Co dál po MVP

- Serverová verze pro ostré použití, kde klíč hodnotitele zůstane skrytý. Schválený plán je v `docs/PRODUCTION.md` (bod 13).
- Třetí role: vedoucí týmu, případně recruiter. Pozor: AI v náboru patří podle evropského AI Actu mezi vysoce rizikové systémy, takže tahle role si žádá opatrnost už v prototypu.
- Pokud by se výsledky používaly pro rozhodování o posunu lidí, spadal by do stejné kategorie i Role Lab sám. Proto důkazy u každého skóre a lidské slovo na konci.
- Mikro-cvičení přímo v aplikaci s druhým krátkým hodnocením.
- Nástroj pro přesné výpočty pro asistenta.
- Přehled pro L&D: rozložení úrovní po rolích, nejčastější slabá dimenze, shoda AI a lidí.
- Anglická verze rozhraní.

## 13. Webová verze (produkční)

Schváleno 8. 11. 2026, podrobný plán v `docs/PRODUCTION.md`. Vedle buildů pro claude.ai vzniká webový build: veřejný odkaz bez účtu v claude.ai a bez předplatného, Clauda platí autor přes vlastní API klíč.

- **Jeden kód, tři sestavení:** demo a verze pro řešitele v claude.ai zůstávají beze změny; webový build volá místo `claude.use("sample")` vlastní serverovou funkci. Rozdíl je na jednom místě v kódu.
- **Server skládá pokyny:** prohlížeč posílá jen zprávy uživatele, ID přiložených podkladů a odevzdaný text. Pokyny pro asistenta a hodnotitele, rubriku a klíč hodnotitele přidává server. Klíč hodnotitele ani pokyny hodnotitele nejsou ve webovém buildu ve zdrojovém kódu stránky.
- **API klíč** jen v nastavení serveru, samostatný workspace v Anthropic Console s limitem útraty.
- **Bez databáze:** postup a výsledek zůstávají v prohlížeči, na serveru se nic neukládá.
- **Limity a ochrana:** stejné limity zpráv jako dnes, navíc pokusy na uživatele a den a celkový denní strop; kontrola vstupů na serveru; požadavky jen z vlastní stránky; logy bez obsahu konverzací.
- **Bezpečnostní požadavky** jsou vypsané v `docs/PRODUCTION.md`, bod 3, a jsou povinné.

