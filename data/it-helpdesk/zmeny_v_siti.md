# Změny v síti

Záznam ze systému správy změn. **Časy jsou v UTC.**

| Číslo | Plánováno (UTC) | Zařízení | Popis | Očekávaný dopad | Stav |
|---|---|---|---|---|---|
| CHG-4466 | 2026-11-26 16:00 | sw-kancelare-2np | Výměna přepínače ve 2. patře kanceláří | krátký výpadek sítě ve 2. patře | hotovo |
| CHG-4471 | 2026-11-30 21:00 | gw-01 | Aktualizace firmwaru brány 7.2.8 → 7.4.1 (bezpečnostní opravy) | žádný | hotovo |
| CHG-4475 | 2026-12-01 07:00 | vpn-portal | Obnova certifikátu portálu pro klientskou VPN | uživatelé při prvním připojení potvrdí nový certifikát | hotovo |
| CHG-4480 | 2026-12-02 16:00 | ap-kancelare-3np | Nové přístupové body Wi-Fi ve 3. patře | žádný | hotovo |

Brána gw-01 zajišťuje firewall, klientskou VPN pro práci z domova i tunel na pobočku Kolín. Certifikát portálu (CHG-4475) používá jen klientská VPN, tunel na Kolín se ověřuje vlastním klíčem.
