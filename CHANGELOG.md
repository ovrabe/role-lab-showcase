# Co je nového

Přehled změn v každé verzi Role Lab. Formát vychází z Keep a Changelog, verze se číslují podle sémantického verzování: oprava zvýší poslední číslo, nová funkce prostřední, zásadní změna první.

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
