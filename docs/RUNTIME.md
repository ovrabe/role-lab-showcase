# Volání Clauda z publikované stránky

Zdroj pravdy jsou soubory `docs/claude-runtime/claude.d.ts` a `docs/claude-runtime/sample.d.ts` (verze prostředí 0.2.66). Tohle je shrnutí pro rychlou orientaci. Při rozporu platí soubory `.d.ts`.

## Základ

```ts
const sample = await window.claude?.use("sample"); // null nebo undefined = bez AI
```

- Mimo claude.ai `window.claude` vůbec neexistuje. Zjisti to hned při startu a přepni do náhledového režimu, nečekej.
- Uvnitř claude.ai se výsledek `use()` vrátí až později, nikdy během prvního běhu skriptu. Stránku vykresli bez něj a AI funkce zapni, až dorazí.
- `sample` dostane buď text, nebo pole zpráv `{ role: "user" | "assistant", content }`, které začíná i končí zprávou `user`. Systémová role neexistuje.
- `sample.json(...)` vrátí rovnou rozparsovaný JSON. V promptu přesně popiš tvar odpovědi.

## Volby

- `modelTier`: `"quick" | "default" | "complex"`. Asistent `default`, hodnotitel `complex`. Skutečně použitou úroveň vrací `modelTierApplied`.
- `onText({ text, delta })`: streamování. `text` je celá odpověď dosud, přiřazuj ji, nepřičítej.
- `signal`: pro každé volání nový `AbortController`. Tlačítko Zastavit volá `abort()`.
- `cache`: u chatu a hodnocení vždy `false`.

## Chyby

Chyba je vždy odmítnutý promise s objektem `{ code, message, text? }`. Větvi podle `code`, nikdy ne podle `message`. Nikdy neopakuj automaticky.

| Kód | Co udělat |
|---|---|
| `cancelled` | Člověk zastavil. Nic nehlásit. |
| `not_granted`, `sampling_disabled`, `not_declared`, `capability_disabled`, `capability_removed` | AI funkce skrýt, vysvětlit česky, že volání Clauda není povolené. |
| `rate_limited` | „Claude je teď vytížený nebo jsi narazil na limit. Zkus to za chvíli.“ |
| `session_expired` | Požádat o nové přihlášení do claude.ai. |
| `invalid_json` | U hodnotitele nabídnout „Zkusit znovu“. |
| `refused`, `empty_completion` | Zobrazit hlášku, rozpracovaný text smazat. |
| `upstream_error` a neznámé kódy | Nechat rozepsaný text (`e.text`), označit jako přerušený, nabídnout ruční opakování. |
| `invalid_request`, `prompt_too_large`, `transform_error`, `queue_overflow` | Chyba v kódu stránky. Vypsat do konzole, člověku obecnou hlášku. |

## Pravidla

- Volat jen na akci člověka (Odeslat, Vyhodnotit), nikdy při načtení, ve smyčce nebo časovačem.
- Stav „Přemýšlím…“ ukazovat od zavolání do prvního `onText`. Zahrnuje i dialog se souhlasem.
- Při publikaci musí stránka deklarovat schopnost `sample`. To zajistí publikace v claude.ai (viz `NAVOD.md`).
