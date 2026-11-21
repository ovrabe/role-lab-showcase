# Systémy na vypadlém diskovém poli

Interní přehled IT, aktualizováno 2. 11. 2026. Doba obnovy je z posledního testu obnovy (říjen 2026).

| Systém | Co dělá | Potřebuje ke spuštění | Doba obnovy |
|---|---|---|---|
| LIC-01 | Licenční server. Licence pro firemní aplikace. | nic | 0,5 h |
| ERP-DB | ERP (databáze a aplikace). Výrobní příkazy, objednávky, fakturace. Dohrání transakčních logů trvá asi 1 hodinu navíc. | LIC-01, AD | 4 h |
| MES | MES (řízení výroby). Bez MES se ve výrobě nedají spouštět zakázky na linkách. | ERP-DB, LIC-01 | 1 h |
| WMS-KOLIN | WMS skladu Kolín. Skenery a expedice ve skladu Kolín. | ERP-DB, AD | 2 h |
| MAIL-01 | E-mail. Záloha je v cloudu, obnova jde i mimo serverovnu. | AD | 3 h |
| FILE-01 | Souborový server. Sdílené složky oddělení. | AD | 6 h |

Doménový řadič AD-02 běží na samostatném fyzickém serveru, výpadek pole ho nezasáhl. AD je tedy k dispozici.

## Záložní server SRV-B

Fyzický server ve stejné serverovně, dnes jen pro testy. 64 GB paměti, 1,5 TB volného místa. Vejdou se na něj LIC-01, ERP-DB, MES a WMS-KOLIN, ne už e-mail a souborový server. Obnovy na SRV-B běží jedna po druhé.
