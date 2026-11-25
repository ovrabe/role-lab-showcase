import { useState } from "react";
import { isParticipantBuild, isWebBuild } from "../buildFlags";
import type { RoleConfig } from "../roles/roleSchema";
import { RoleRubric } from "../methodology/RoleRubric";
import { AiIcon } from "../components/AiIcon";
import { Ban, BarChart3, Calculator, Database, EyeOff, FileSearch, HardDrive, Quote, Scale, ShieldAlert, Sigma, UserCheck, Wallet, type LucideIcon } from "lucide-react";
import { InfoTabs } from "../components/InfoTabs";
import { CalibrationSection } from "../methodology/CalibrationSection";

type MethodologyScreenProps = {
  roles: RoleConfig[];
  onOpenCalibration: () => void;
  onOpenSamples: () => void;
  // Web version: the tab to "O projektu" (src/components/InfoTabs.tsx).
  onOpenAbout?: () => void;
};

// The rubric, thresholds and cap come from the selected role's config; the rest is the same for every role.
export function MethodologyScreen({ roles, onOpenCalibration, onOpenSamples, onOpenAbout }: MethodologyScreenProps) {
  const [roleId, setRoleId] = useState(roles[0]?.id ?? "");
  const role = roles.find((candidate) => candidate.id === roleId);

  return (
    <article className="max-w-2xl mx-auto">
      {onOpenAbout && <InfoTabs current="methodology" onSelect={(page) => page === "about" && onOpenAbout()} />}
      <h1 className="mb-6">Jak hodnotíme</h1>

      <p className="card flex gap-4 mb-8">
        <span aria-hidden="true" className="shrink-0 grid place-items-center size-10 rounded-full bg-paper">
          <AiIcon size={20} />
        </span>
        <span>
          Nehodnotíme, co o AI víš, ale jak s ní pracuješ. Řešíš realistický pracovní úkol, jaký se ve tvé roli
          běžně dělá. Data v něm jsou vymyšlená. Aplikace zaznamená celý postup a jiný model ho posoudí podle veřejné
          rubriky. Hodnocení navrhla AI. Konečné slovo má člověk.
        </span>
      </p>

      {roles.length > 1 && (
        <label className="block mb-6">
          <span className="font-semibold mr-2">Rubrika pro roli</span>
          <select
            value={roleId}
            onChange={(event) => setRoleId(event.target.value)}
            className="rl-select"
          >
            {roles.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.title}
              </option>
            ))}
          </select>
        </label>
      )}
      {role && <RoleRubric role={role} />}

      <h2 className="mb-3">Férovost</h2>
      <IconList items={fairness} />

      <CalibrationSection />

      <h2 className="mb-3">Co dělá asistent</h2>
      <IconList
        items={[
          { icon: Calculator, text: "Pomáhá s tím, o co ho požádáš: analýza, výpočty, návrhy textu, oponentura." },
          { icon: Database, text: "S podklady pracuje jen tehdy, když mu je přiložíš nebo vložíš do konverzace." },
          {
            icon: FileSearch,
            text: "Odpovídá na to, na co se ptáš. Podklady sám od sebe neprověřuje. Když se ale zeptáš na konkrétní údaj nebo ho požádáš o kontrolu, odpoví pravdivě a úplně.",
          },
          { icon: Ban, text: "O hodnocení nic neví a správnou odpověď ti neřekne." },
        ]}
      />

      <h2 className="mb-3">Co se ukládá a kdo platí</h2>
      <IconList items={isWebBuild ? webDataFacts : claudeAiDataFacts} />

      {/* Credit required by the CC BY licence of the profile icons (src/profile/emblems.ts). Here,
          because this page exists in every build; kept small, away from the icons themselves. */}
      <p className="text-sm text-ink-muted mb-4">
        Ikony v profilu:{" "}
        <a href="https://game-icons.net" target="_blank" rel="noopener noreferrer" className="underline">
          game-icons.net
        </a>{" "}
        (Delapouite, Lorc, Caro Asercion, Skoll), licence CC BY 3.0.
      </p>

      {/* Quiet on purpose: both are for the author, not for people taking the task.
          The samples in particular reveal the data traps, so the participant build has no links. */}
      {!isParticipantBuild && (
        <p className="text-sm text-ink-muted border-t border-line pt-4">
          Pro autora:{" "}
          <button type="button" onClick={onOpenCalibration} className="underline underline-offset-4">
            kalibrace hodnotitele
          </button>
          {" · "}
          <button type="button" onClick={onOpenSamples} className="underline underline-offset-4">
            ukázková hodnocení
          </button>
        </p>
      )}
    </article>
  );
}

const fairness = [
  { icon: Quote, text: "Každé skóre je doložené citací ze záznamu. Aplikace ověří, že citace v záznamu opravdu je." },
  { icon: Sigma, text: "Celkovou úroveň počítá kód podle pevných pravidel, ne model." },
  { icon: UserCheck, text: "Hodnocení je návrh. Člověk ho může upravit a konečné slovo má on." },
  { icon: EyeOff, text: "Hodnotitel nezná jméno řešitele a píše genderově neutrálně." },
];

// The web version calls Claude through the project's own server (docs/PRODUCTION.md); the
// claude.ai pages call it through the viewer's account. Anthropic's API terms checked
// 2026-11-11: API data is not used for training and is deleted within 30 days.
const webDataFacts = [
  {
    icon: Wallet,
    text: "Účet ani předplatné nepotřebuješ. Volání Clauda platí autor, proto má každý dva pokusy denně.",
  },
  {
    icon: HardDrive,
    text: "Průběh úkolu se ukládá jen ve tvém prohlížeči. Server z konverzace nic neukládá. Kvůli dennímu limitu si nejdéle dva dny pamatuje jen počet pokusů a otisk IP adresy a náhodného čísla, které si vygeneroval tvůj prohlížeč. Z otisku původní hodnotu zjistit nejde a náhodné číslo s tebou nijak nesouvisí. Díky němu má vlastní limit každý, i když jednu síť sdílí několik lidí. Proti robotům web chrání Vercel BotID: když voláš AI, posíláš zpětnou vazbu nebo vlastní výzvu, posoudí podle IP adresy a technických údajů o prohlížeči, jestli jde o člověka. Do provozního záznamu jde jen jeho verdikt, bez adresy. Výsledek si můžeš stáhnout.",
  },
  {
    icon: BarChart3,
    text: "Aby šla aplikace zlepšovat, počítají se 90 dní anonymní denní součty: které obrazovky se otevírají, jak úkoly probíhají a dopadají (úroveň, skóre, nalezené záludnosti), jak rychle a za kolik odpovídají modely a kolik nastalo chyb. Počet návštěvníků se odhaduje z otisku, který se každý den mění, takže návštěvy nejde spojit mezi dny. Návštěvnost a rychlost načítání měří také Vercel Web Analytics, bez cookies. Texty, jména ani IP adresy v těchto součtech nejsou.",
  },
  {
    icon: ShieldAlert,
    text: "Konverzaci zpracovává Claude od společnosti Anthropic. Anthropic data z API nepoužívá k tréninku modelů a do 30 dnů je maže. Déle je může uchovat jen při podezření na porušení pravidel nebo když to vyžaduje zákon. Nevkládej proto skutečná firemní ani osobní data. Úkol je postavený na vymyšlených podkladech.",
  },
  // The information GDPR (Art. 13) asks for, in two items: who, what, where, how long; then
  // legal bases and rights. The contact is the feedback form on purpose (the author's decision,
  // 24. 11. 2026); the legal basis "you asked for it" for the task and conversation too (25. 11.).
  {
    icon: UserCheck,
    text: "Osobní údaje zpracovává autor aplikace Ondřej Vrabeľ. Kromě otisku pro denní limit se uloží jen to, co pošleš: zpětná vazba s nepovinným e-mailem na 90 dní a vlastní výzva na 30 dní. E-mail vidí jen autor. Text zpětné vazby a žádost o sdílení výzvy jdou i do jeho soukromého seznamu námětů na GitHubu, kde zůstanou, dokud je nesmaže. Databáze Upstash a serverové funkce na Vercelu běží ve Frankfurtu. Dál data zpracovávají Anthropic (konverzace s AI), GitHub (seznam námětů) a Vercel (provoz webu, měření návštěvnosti a ochrana proti robotům), a to i v USA.",
  },
  {
    icon: Scale,
    text: "Konverzace s AI a vlastní výzva se zpracovávají, protože o ně žádáš: bez toho by nešlo vyřešit úkol ani vytvořit výzvu. Limity, ochrana proti robotům a anonymní součty se zpracovávají na základě oprávněného zájmu na bezpečném provozu a proti tomu můžeš vznést námitku. Zpětná vazba se zpracovává na základě tvého souhlasu, když ji pošleš, a souhlas můžeš kdykoli odvolat. Chceš vědět, co o tobě aplikace má, opravit to nebo smazat? Napiš přes „Poslat zpětnou vazbu“ dole na stránce. Stížnost můžeš podat Úřadu pro ochranu osobních údajů.",
  },
];

const claudeAiDataFacts = [
  {
    icon: HardDrive,
    text: "Průběh úkolu se ukládá jen ve tvém prohlížeči. Aplikace nemá server ani databázi. Výsledek si můžeš stáhnout.",
  },
  {
    icon: Wallet,
    text: "Asistenta i hodnotitele obsluhuje Claude přes účet toho, kdo stránku otevřel. Volání jdou z jeho limitu a při prvním volání o souhlas požádá claude.ai.",
  },
  {
    icon: ShieldAlert,
    text: "Obsah konverzace zpracovává Claude. Nevkládej proto skutečná firemní ani osobní data. Úkol je postavený na vymyšlených podkladech.",
  },
];

// Facts as a card of rows with a small icon each, instead of a bulleted list.
function IconList({ items }: { items: { icon: LucideIcon; text: string }[] }) {
  return (
    <ul className="card space-y-4 mb-8">
      {items.map(({ icon: Icon, text }) => (
        <li key={text} className="flex gap-3">
          <span aria-hidden="true" className="shrink-0 grid place-items-center size-8 rounded-full bg-paper text-ink-muted">
            <Icon size={16} strokeWidth={2} />
          </span>
          <span className="pt-1">{text}</span>
        </li>
      ))}
    </ul>
  );
}
