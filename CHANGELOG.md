# Co je nového

Přehled změn v každé verzi Role Lab. Formát vychází z Keep a Changelog, verze se číslují podle sémantického verzování: oprava zvýší poslední číslo, nová funkce prostřední, zásadní změna první.

## 1.9.2 – 20. 11. 2026

Drobnosti pro první testery.

### Změněno

- Poznámka „Je to trénink, ne zkouška. Výsledek vidíš jen ty.“ je i na počítači pod nadpisem „Vyber si roli“ a karty rolí začínají o kus níž.
- Prohlídka na konci řekne, co najdeš navíc na vlastním výsledku: „Proč tohle skóre?“, silný pokus, tahák a kartu ke stažení.

### Opraveno

- Čtečky obrazovky už nepředčítají každou změnu kroku během hodnocení a oznámí odpověď na „Proč tohle skóre?“ i načtený silný pokus.
- Testy ve veřejné kopii projektu, které potřebují neveřejná data, se v ní přeskočí.

## 1.9.1 – 20. 11. 2026

Oprava vydání 1.9.0, které se kvůli chybě v sestavení serveru nenasadilo. Obsahuje všechny změny z 1.9.0.

### Opraveno

- Serverové funkce se znovu sestaví a nasadí.

## 1.9.0 – 20. 11. 2026

Srozumitelnější hodnocení.

### Přidáno

- „Proč tohle skóre?“ u každé oblasti výsledku: krátké vysvětlení s citacemi ze záznamu, které aplikace ověří. Odpověď se uloží k pokusu.
- Během hodnocení stránka ukazuje, na čem hodnotitel pracuje, a jeden tip na příště.

### Změněno

- U výběru role stojí, že jde o trénink, ne zkoušku, a že výsledek vidíš jen ty.
- Stránka O projektu uvádí výsledky nové kalibrace hodnotitele.

## 1.8.0 – 17. 11. 2026

Víc z výsledku a levnější hodnocení.

### Přidáno

- Tahák formulací: u nejslabší oblasti ukázky, jak AI zadat lépe.
- Karta s výsledkem ke stažení (obrázek PNG): úroveň, silné stránky a kroky na příště.
- „Jak to řešil silný pokus“: vymyšlený silný pokus o stejný úkol vedle tvého výsledku, s tím, co na něm hodnotitel ocenil. Ukáže se až po tvém hodnocení.
- Anonymní statistika pro autora: denní součty začatých, odevzdaných a ohodnocených pokusů, bez identity a bez textů.

### Změněno

- Hodnotitel pracuje s nižším úsilím. Kalibrace na všech 13 úkolech dopadla stejně, hodnocení je zhruba o třetinu levnější a rychlejší.

## 1.7.0 – 17. 11. 2026

Férovější limity, hlídání útraty a pevnější hodnocení.

### Přidáno

- Denní limity se počítají pro každý prohlížeč zvlášť, takže lidé na jedné síti (kancelář, domácnost) už nesdílejí jeden limit. Jedna IP adresa má strop zhruba čtyř lidí. Prohlížeč si k tomu uloží náhodné číslo, které s tebou nijak nesouvisí.
- Denní rozpočet podle skutečné útraty: nejvýš 1,50 $ z jedné IP adresy a 3 $ celkem za den. Když se vyčerpá, autor dostane upozornění do seznamu námětů.
- Kontrola ostrého webu po vydání jedním příkazem (`npm run smoke`).

### Změněno

- Citace v hodnocení se ověřují jen jako celá slova, takže „10 %“ se už nenajde v „110 %“.
- Když vysoké skóre dokládají jen odpovědi asistenta, hodnocení je označené ke kontrole člověkem.
- Během hodnocení stránka upozorní, ať ji nezavíráš, a před zavřením se zeptá.
- Když nejde ověřit denní limit, stránka napíše, že má Role Lab potíže, místo „spojení s Claudem se přerušilo“.

### Bezpečnost

- Kontrola webového buildu hlídá všechny věty z klíčů hodnotitele, nejen popisy záludností.

## 1.6.5 – 17. 11. 2026

Opravy po bezpečnostní a provozní revizi.

### Opraveno

- Když AI přestane fungovat pro všechny (došlý kredit nebo neplatný klíč), stránka to srozumitelně řekne a nenabízí opakování dokola. Pokus se nepočítá do denního limitu a autorovi jednou denně přijde upozornění do seznamu námětů.
- Volání, které selže dřív, než AI cokoli napíše, už neubere pokus z denního limitu.
- Zpráva delší než 20 000 znaků se neodešle. Stránka to oznámí a text nechá v poli. Dřív taková zpráva, nebo dlouhá odpověď asistenta, úkol nevratně zablokovala.
- Hodnocení velmi dlouhé konverzace už neskončí chybou: pro hodnotitele se zkrátí střed nejdelších odpovědí asistenta, zprávy člověka zůstanou celé.
- Stejný úkol otevřený ve dvou kartách: starší karta už nepřepíše odevzdání ani hodnocení z druhé karty.
- Uložená práce, kterou by budoucí verze nepřečetla, se před přepsáním zálohuje.
- Hodnocení na webu nezablokuje velké množství událostí v záznamu (ukládání odevzdání, stahování podkladů).
- Hláška o vyčerpaném osobním limitu už neuvádí „dva pokusy denně“ i u chatu.

### Bezpečnost

- Server kontroluje čas každé zprávy, takže přes něj nejde vložit text do pokynů hodnotiteli.
- Text ze zpětné vazby je v seznamu námětů jako citace s poznámkou, že nejde o pokyny. Zmínky typu @jméno nikoho neupozorní.

### Změněno

- Chat používá cachování promptů, takže jeden pokus stojí zhruba o třetinu méně.
- Volání Clauda má časový limit a opakuje se nejvýš jednou, takže při výpadku nikdo nečeká bez konce.

## 1.6.4 – 16. 11. 2026

Vzdušnější banner na počítači.

### Změněno

- Text v úvodním banneru je na počítači širší: podnadpis se vejde na jeden řádek a tlačítka do jedné řady.
- Nadpis a podnadpis banneru jsou na počítači o kus větší a mezi nadpisem, textem a tlačítky je víc místa. Na telefonu je banner vzdušnější jen v řádkování.
- Přepínač motivu v hlavičce je dál od obrázku profilu.

## 1.6.3 – 16. 11. 2026

Kratší testovací scénář.

### Změněno

- Testovací scénář (`?testovani`) zabere asi 10 minut místo 40. Kroky jdou v pořadí proč, co, jak, co když: k čemu aplikace je, jak funguje, jak se v ní pohybuje a co tester z používání bude mít. Úkol z role je volitelný na konci.
- Pokyny ve scénáři odpovídají novému úvodu: karta Výzva dne, devět rolí, mapa výzev přes odkaz „Všechny výzvy“.
- V úvodu scénáře stojí, že každá otázka je nepovinná a odeslat jde kdykoli.

## 1.6.2 – 16. 11. 2026

Dvě drobné opravy.

### Opraveno

- Vlna v úvodním banneru na počítači už není vlevo useknutá.

### Změněno

- Odkaz na zpětnou vazbu v patičce se jmenuje „Poslat zpětnou vazbu“, aby se nepletl s odkazem „Napiš autorovi“ u rolí.

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
