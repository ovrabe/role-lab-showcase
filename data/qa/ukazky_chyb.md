# Ukázky chyb z nočních běhů

Vybral automatický report, 15. 1. 2027.

**platba_karta_uspech**, 14. 1. 2:07
```
TimeoutError: platební brána (sandbox) neodpověděla do 30 s
  při POST /sandbox/v2/payments
```

**platba_3ds_overeni**, 14. 1. 2:11
```
TimeoutError: platební brána (sandbox) neodpověděla do 30 s
  při GET /sandbox/v2/3ds/challenge
```

**vraceni_platby**, 13. 1. 3:41
```
HTTP 503 Service Unavailable od /sandbox/v2/refunds
```

**kosik_pridani_stejne_polozky**, 11. 1. 2:19
```
AssertionError: v košíku má být 1 řádek s množstvím 2, nalezeny 2 řádky po 1 kusu
  snímek obrazovky: kosik-2027-01-11.png (mikina Nordic, 2× samostatně)
```
