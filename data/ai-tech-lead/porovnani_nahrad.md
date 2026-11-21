# Porovnání náhrad za Lark S

Připravil: Tomáš, vývojář v týmu AI, 19. 11. 2026.

Lark S dnes používáme na dvě věci: třídění požadavků podpory do front (asi 12 000 volání měsíčně) a chatbota v nápovědě (asi 14 000 volání měsíčně). Porovnali jsme dvě náhrady: Lark S2 od stejného dodavatele a Quill Mini od jiného.

## Přesnost třídění

Test na 300 požadavcích z října, které lidé z podpory ručně zařadili.

| Model | Přesnost celkem | Stížnosti s právním rizikem |
|---|---|---|
| Lark S (dnes) | 88,3 % | 13 z 15 |
| Lark S2 | 90,3 % | 11 z 15 |
| Quill Mini | 89,0 % | 13 z 15 |

Pro Lark S2 jsme prompt vylepšili: přidali jsme do něj 60 ukázkových požadavků z říjnového vzorku i se správnou frontou, aby se model naučil naše fronty. Ukázky: R-1001, R-1006, R-1011, R-1016, R-1021, R-1026, R-1031, R-1036, R-1041, R-1046, R-1051, R-1056, R-1061, R-1066, R-1071, R-1076, R-1081, R-1086, R-1091, R-1096, R-1101, R-1106, R-1113, R-1118, R-1123, R-1128, R-1133, R-1138, R-1143, R-1148, R-1153, R-1158, R-1163, R-1168, R-1173, R-1178, R-1183, R-1188, R-1193, R-1195, R-1200, R-1205, R-1210, R-1215, R-1220, R-1225, R-1230, R-1235, R-1240, R-1245, R-1250, R-1255, R-1263, R-1271, R-1279, R-1286, R-1289, R-1292, R-1295, R-1298.

## Náklady

Odhad měsíčních nákladů pro oba způsoby použití podle ceníků:

| Model | Odhad za měsíc | Rozdíl proti dnešku |
|---|---|---|
| Lark S (dnes) | 15 552 Kč | – |
| Lark S2 | 10 368 Kč | −33,3 % |
| Quill Mini | 18 144 Kč | +16,7 % |

Odhad počítá s dnešním počtem tokenů na volání a cenami z ceníků.

## Rychlost chatbota

Medián odpovědi chatbota ve stínovém provozu: Lark S 1,4 s, Lark S2 2,6 s, Quill Mini 1,5 s. Podrobné měření je v samostatném souboru.

## Doporučení

Navrhuji Lark S2: je nejpřesnější, o třetinu levnější a přechod u stejného dodavatele je nejjednodušší. Přepnout bychom mohli v prosinci.
