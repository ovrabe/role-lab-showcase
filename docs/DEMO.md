# Předvedení za tři minuty

Cíl: ukázat dvě věci. Role Lab měří, jak člověk s AI pracuje, ne co o ní ví. A celý produkt vznikl přístupem AI-first: AI psala kód, testy a revize, člověk určoval směr, kontroloval kvalitu a rozhodoval o riziku a nákladech.

Předvádí se z webové verze: https://role-lab-gamma.vercel.app. Na živé volání Clauda nespoléhej. Prohlídka a stránka Jak vznikl fungují bez AI a hned.

## Průběh (živě nebo na sdílené obrazovce)

**Problém (20 s).** Firmy chtějí, aby lidé uměli pracovat s AI. Test znalostí ale ukáže, co člověk o AI ví, ne jak s ní na skutečné práci pracuje. Hodnocení navíc musí být doložitelné, jinak mu nikdo nevěří.

**Prohlídka (70 s).** Otevři `?prohlidka`. Úkol category managera: vybrat kávu do předplatného, data jsou vymyšlená. Ukaž zadání, chat s asistentem a odevzdání. Jedna věta: asistent dělá, co se po něm chce, a data sám neprověřuje. Hodnotí se, jestli to člověk udělá.

**Hodnocení (50 s).** Na výsledku prohlídky klikni na citaci a nech záznam sjet na dané místo. Řekni: každé skóre dokládá citace, aplikace ověří, že v záznamu opravdu je. Celkovou úroveň počítá kód, ne model. Člověk může každé skóre upravit. Na vlastním výsledku je navíc „Proč tohle skóre?“ a silný pokus o stejný úkol pro srovnání.

**Jak vznikl (30 s).** Otevři `?jak-vznikl`. Křivka práce: funkční prototyp po ~4,5 h aktivní práce, úplný prototyp za víkend (~9,5 h), veřejný web po ~16 h, dnešní stav ~44 h. Pak jedna věc podle publika: schéma a tabulka hrozeb (pro IT), cesta změny do produkce (pro vývojáře), rozhodnutí podle měření (pro vedení).

**Co dál (10 s).** Teď trénink, ne zkouška. Další kroky: vlastní výzva podle struktury dat konkrétní firmy, vyšší obtížnosti u nových rolí, kalibrace na skutečných lidech.

## Když odkaz posíláš e-mailem

Adresát projde sám, v tomhle pořadí:

1. `?jak-vznikl`, 2 minuty: jak a za kolik práce produkt vznikl.
2. `?prohlidka`, 3 minuty: celý průběh na hotovém příkladu, bez čekání na AI.
3. Volitelně jedna výzva (asi 5 minut) nebo celý úkol (asi 15 minut) s vlastním hodnocením.

## Otázky, na které se připrav

- **Co když model hodnotí pokaždé jinak?** Citace u každého skóre, úroveň počítaná v kódu, kalibrace: slabý, střední a silný pokus se nikdy neprohodily a výsledek se mezi běhy lišil nejvýš o 0,2 bodu.
- **Co když asistent spočítá něco špatně?** Hodnotitel rozlišuje chybu člověka od chyby asistenta. Ověřit výstup AI je jedna z hodnocených dovedností.
- **Kolik to stojí?** Celý pokus 5–7 Kč, platí se jen volání modelu. Denní rozpočet a limity chrání před zneužitím.
- **Jak rychle přidáte roli?** Role je konfigurace a podklady, kód se nemění. Sedm rolí přibylo během jednoho dne, každá až po kalibraci hodnotitele.
- **Kam jdou data?** Záznam práce zůstává v prohlížeči. Na server jde jen to, co je nutné pro volání modelu, a anonymní statistika bez obsahu.
