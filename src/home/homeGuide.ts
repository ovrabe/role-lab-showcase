import type { GuideStep } from "./FirstVisitGuide";

// What a first visitor should do, in this order (shown once; the "?" in the banner repeats it).
export const guideKey = "role-lab:guide:home";
export const guideSteps: GuideStep[] = [
  {
    target: "tour",
    title: "Začni prohlídkou",
    text: "Na ukázkovém úkolu uvidíš za 2 minuty celý postup: zadání, rozhovor s AI, odevzdání a hodnocení. Nic se nepočítá.",
  },
  {
    target: "roles",
    title: "Pak si vyber roli",
    text: "Každá role má úkoly podle obtížnosti, od 15 do 45 minut. Úkol řešíš s AI asistentem a na konci uvidíš hodnocení s konkrétními kroky, jak se zlepšit.",
  },
  {
    target: "challenge",
    title: "Na krátkou chvíli",
    text: "Výzva dne procvičí jednu dovednost za 5 minut a hned ji ohodnotí.",
  },
];
