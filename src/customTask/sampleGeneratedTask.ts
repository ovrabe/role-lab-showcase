import type { GeneratedTask } from "./generatedTask";

// A valid generator answer: the fake Claude returns it locally and in tests, so the whole flow
// works without an API key. The trap is the one-off in row 11 (eye drops in November).
export const sampleGeneratedTask: GeneratedTask = {
  title: "Objednávka volně prodejných léků na prosinec",
  roleTitle: "Nákupčí v síti lékáren",
  roleContext: "Síť 40 lékáren, měsíční objednávky volně prodejných léků",
  brief: {
    situation: "Jsi nákupčí v síti 40 lékáren. Je pondělí 30. 11. a do středy musíš poslat objednávku volně prodejných léků na prosinec.",
    task: "Navrhni, kolik kusů které položky objednat na prosinec. Vycházej z prodejů za poslední tři měsíce a počítej s rezervou 10 %.",
    deliverable: "Krátký e-mail pro vedoucí nákupu: objednávka po položkách a zdůvodnění, nejvýš 800 znaků.",
  },
  table: {
    title: "Prodeje volně prodejných léků",
    period: "září až listopad, součet za 40 lékáren",
    columns: [
      { name: "lek", meaning: "Položka" },
      { name: "jednotka", meaning: "V čem se prodává" },
      { name: "prodej_zari", meaning: "Prodané kusy v září" },
      { name: "prodej_rijen", meaning: "Prodané kusy v říjnu" },
      { name: "prodej_listopad", meaning: "Prodané kusy v listopadu" },
    ],
    csv: [
      "lek,jednotka,prodej_zari,prodej_rijen,prodej_listopad",
      "Ibuprofen 400 mg,ks,420,410,435",
      "Paracetamol 500 mg,ks,390,402,398",
      "Sirup proti kašli,ks,160,171,158",
      "Nosní sprej,ks,210,205,220",
      "Vitamín C 1000,ks,180,176,189",
      "Magnezium 250,ks,95,101,98",
      "Pastilky na krk,ks,240,251,236",
      "Gel na klouby,ks,88,92,85",
      "Probiotika,ks,70,68,74",
      "Náplasti mix,ks,130,126,137",
      "Kapky do očí,ks,60,58,4100",
      "Teploměr digitální,ks,25,27,24",
    ].join("\n"),
  },
  notes: {
    title: "Poznámky kolegyně z nákupu",
    markdown: "Prosincovou objednávku navrhuji spočítat jako průměr září až listopadu plus 10 % rezerva. Kapky do očí výrazně rostou, u nich bych rezervu ještě zvýšila.",
  },
  trap: {
    title: "Jednorázový výkyv u kapek do očí",
    whatIsWrong: "Kapky do očí mají v listopadu 4100 kusů, v září a říjnu kolem 60. Jde o jednorázovou velkou zakázku nebo chybu v datech. Průměr s ní vychází asi 1 400 kusů místo zhruba 65.",
    naiveEffect: "Kdo spočítá průměr bez kontroly, objedná přes 1 500 kusů kapek, které se neprodají.",
    caughtIf: "Odpověď si výkyvu všimne a objednávku kapek počítá bez listopadové hodnoty nebo ji ověří.",
    partialIf: "Výkyv zazní, ale objednávka ho nezohlední.",
    missedIf: "Objednávka kapek vychází z průměru včetně listopadu.",
    cell: { row: 11, column: "prodej_listopad", value: "4100" },
  },
  judgmentMarkers: [
    "Silná odpověď ověří výpočet průměru u více položek, ne jen u kapek.",
    "Dobrá odpověď navrhne zjistit, co se v listopadu u kapek stalo.",
  ],
  facts: { kapky_prumer_s_vykyvem: 1406, kapky_prumer_bez_listopadu: 59 },
};
