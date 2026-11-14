# Předvedení za tři minuty

Cíl: ukázat, že hodnocení AI dovedností může měřit práci s AI, ne znalosti o ní, a že AI v tom procesu dělá většinu práce, zatímco člověk drží rozhodnutí.

Nespoléhej na živé volání Clauda. Měj připravené dva hotové běhy (slabý a silný) z kalibračních fixtures, načtené tak, aby se výsledek dal otevřít okamžitě. Ukázky otevřeš dole na stránce Jak hodnotíme → ukázková hodnocení. Jsou jen v ukázkové verzi stránky (`npm run build`); verze pro řešitele (`npm run build:resitel`) je nemá, takže předváděj z ukázkového odkazu.

## Průběh

**Problém (20 s).** Povinné AI dovednosti napříč firmou potřebují hodnocení. Test znalostí ukáže, co člověk o AI ví, ne jak s ní pracuje. A když hodnocení ovlivňuje posun lidí, musí být doložitelné.

**Úkol (50 s).** Otevři úkol category managera. Zadání je reálná práce: tři produkty posílit před Black Friday, dvě zásoby snížit. Ukaž asistenta a přiložení dat. Řekni jednu věc: asistent odpovídá na to, na co se člověk ptá, a data sám neprověřuje. Hodnotí se, jestli se člověk zeptá.

**Výsledek (60 s).** Otevři silný běh. Ukaž jednu dimenzi, klikni na citaci a nech záznam sjet na daný tah. Pak rozbor záludností, které byly schované v datech. Tady se hodnocení mění v učení. Na konci další krok s mikro-cvičením.

**Srovnání (20 s).** Přepni na slabý běh. Stejný úkol, jiná úroveň, a u každého skóre je vidět proč.

**Proč takhle (20 s).** AI úkol provází, hodnotí a navrhuje další krok. Úroveň počítají pevná pravidla, ne model. Člověk z L&D může každé skóre upravit a shoda mezi AI a lidmi je první metrika, kterou sleduju.

**Co dál (10 s).** Druhá role, kalibrace na skutečných lidech, přehled pro L&D.

## Otázky, na které se připrav

- Co když asistent spočítá něco špatně? — Hodnotitel rozlišuje chybu člověka od chyby asistenta. Kalibrace to kontroluje.
- Jak zabráníte tomu, aby model hodnotil pokaždé jinak? — Citace u každého skóre, úroveň počítaná v kódu, kalibrace na třech záznamech s tolerancí jedné úrovně.
- Jak rychle přidáte další roli? — Ukaž projektového manažera: stejná aplikace, jiný JSON, jiné podklady a jiný klíč. Kód se nemění.
