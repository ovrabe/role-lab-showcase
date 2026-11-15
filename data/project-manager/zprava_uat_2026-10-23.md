# Projekt Kompas: zpráva z akceptačních testů

23. 10. 2026, připravila vedoucí podpory s dodavatelem Tikeo

## Shrnutí

Otestovali jsme 142 scénářů ve všech čtyřech zemích. Prošlo 136, u šesti jsme našli chybu. **Kritické chyby: 0.** Doporučujeme spustit podle plánu 2. 11.

## Nalezené chyby

Závažnost: kritická = systém nejde použít, střední = funkce nefunguje, ale existuje obchvat nebo se týká jen menší části práce, nízká = kosmetická vada.

| Chyba | Závažnost | Země | Popis | Stav |
|---|---|---|---|---|
| BUG-41 | nízká | CZ | V podpisu e-mailu se špatně zobrazuje diakritika u některých jmen. | Opraveno v testu, nasadí se 30. 10. |
| BUG-43 | nízká | všechny | Řazení tiketů podle data v přehledu agenta je obrácené. | Opraví se v další verzi 13. 11. |
| BUG-44 | střední | SK | Export týdenního reportu do Excelu nefunguje, náhradní export do CSV ano. | Opraví se v další verzi 13. 11. |
| BUG-47 | střední | HU | Vyhledání objednávky nevrátí výsledek u objednávek v HUF. Týká se všech objednávek z maďarského e-shopu. | Opraví se v další verzi 13. 11. |
| BUG-48 | nízká | PL | Překlep ve dvou šablonách odpovědí. | Opraveno, nasadí se 30. 10. |
| BUG-49 | střední | všechny | Upozornění na blížící se termín odpovědi chodí o hodinu později (letní čas). | Opraví se v další verzi 13. 11. |

## Poznámka

Vyhledání objednávky podle čísla agenti používají asi u dvou třetin tiketů, hlavně u reklamací a dotazů na doručení.
