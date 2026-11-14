# Návod: jak postavit Role Lab v Claude Code

Bez API klíče. Claude Code se přihlašuje tvým účtem claude.ai a hotová stránka volá Clauda přes účet toho, kdo ji otevře.

## A. Příprava (jednou)

1. **Ověř předplatné.** Claude Code potřebuje placený plán Pro nebo Max. S bezplatným účtem nepoběží.
2. **Nainstaluj aplikaci Claude** z claude.com/download a přihlas se stejným účtem jako na claude.ai.
3. **Jen na Windows:** nainstaluj Git z git-scm.com (výchozí volby stačí) a aplikaci Claude pak zavři a znovu otevři.
4. **Nainstaluj Node.js** ve verzi LTS z nodejs.org. Potřebuje ho sestavení stránky. Když si nejsi jistý, jestli už ho máš, zeptej se v kroku 7 Claude Code, ať to ověří.
5. **Rozbal zip** do složky, kterou snadno najdeš, třeba `Dokumenty/role-lab`.
6. **Otevři v aplikaci záložku Code**, nastav prostředí na Local a vyber složku `role-lab`.

**Bezpečnost:** kdyby ti Claude Code kdykoli nabídl přihlášení API klíčem nebo nákup API kreditu, odmítni. Přihlášení účtem claude.ai stačí.

## B. Stavba po milnících

7. **Vlož úvodní zadání:**

   ```
   Přečti CLAUDE.md, NAVOD.md a všechny soubory v docs/, data/ a evaluator-data/. Pak mi česky a jednoduše shrň, co budeme stavět, a navrhni plán pro milník M0. Nic neinstaluj a neměň, dokud plán neschválím.
   ```

8. **Přečti plán a schval ho**, nebo řekni, co změnit. Tak to jde u každého milníku: plán, souhlas, práce, shrnutí.
9. **Povolování příkazů.** Claude Code se bude ptát, jestli smí spustit příkazy, třeba `npm install`. Příkazy uvnitř složky projektu povoluj. Když bude chtít něco mimo složku, heslo správce nebo cokoli, čemu nerozumíš, zastav se a zeptej se v chatu.
10. **Po každém milníku** napiš: „Ulož tuhle verzi do gitu s popisem milníku.“ Když se pak něco pokazí, jde se vrátit.
11. **Testování na počítači.** Claude Code ti řekne, ať spustíš `npm run dev` (nebo to spustí sám) a otevřeš odkaz, obvykle `http://localhost:5173`. Nahoře uvidíš pruh „Náhled bez AI“. To je v pořádku: M0 a M1 se celé testují takhle.
12. **Když něco nefunguje,** napiš Claude Code, co jsi udělal, co jsi čekal a co se stalo. Přilož snímek obrazovky.

## C. Test s AI v claude.ai (od milníku M2)

AI funguje jen uvnitř claude.ai. Na počítači ji neotestuješ.

13. Řekni Claude Code: „Sestav stránku.“ Vznikne soubor `dist/index.html`.
14. Na claude.ai otevři v projektu AI Job Hunter nový chat, nahraj `dist/index.html` a napiš:
    - poprvé: „Publikuj tento soubor jako artefakt Role Lab s povolenou schopností sample.“
    - příště: „Aktualizuj artefakt [odkaz] tímto souborem a schopnosti ponech.“
15. Otevři artefakt. Při prvním dotazu na asistenta se claude.ai zeptá, jestli stránka smí volat Clauda. Povol. Volání jde z tvého limitu.
16. Otestuj, co Claude Code k milníku popsal. Chyby nes zpátky do Claude Code (krok 12) a opakuj od kroku 13.

## D. Na konci

17. **Kalibrace (M3.5)** běží jen v publikované verzi a spotřebovává tvůj limit. Pusť ji, až budeš mít na limitu rezervu.
18. **Před posláním komukoli** mi pošli odkaz. Ověříme, jak stránka vypadá z pohledu jiného člověka, a že tam není nic, co tam být nemá.

## Dobré vědět

- Klíč hodnotitele je uvnitř stránky. Kdo otevře zdrojový kód, záludnosti najde. Na předvedení to nevadí, pro ostré hodnocení lidí by to neprošlo.
- Kdo stránku otevře, platí volání ze svého účtu claude.ai a musí je povolit.
