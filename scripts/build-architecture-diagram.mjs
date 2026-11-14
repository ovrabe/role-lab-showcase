// Draws the infrastructure diagram for the README (docs/architecture-light.svg and
// docs/architecture-dark.svg). Drawn by hand instead of Mermaid, which lays boxes out on
// its own and cannot look tidy; generated from one script so both colour variants always
// show the same thing. After a change in the infrastructure, edit the layout below and run:
//
//   node scripts/build-architecture-diagram.mjs [output folder, default docs]
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const outputFolder = process.argv[2] ?? "docs";

// Colours close to GitHub's own, so the picture sits naturally in its light and dark theme.
const themes = {
  light: {
    text: "#1f2328", muted: "#59636e", line: "#818b98",
    card: "#ffffff", cardStroke: "#d1d9e0", panel: "#f6f8fa", panelStroke: "#d1d9e0",
    accent: "#4f46e5", accentFill: "#eef2ff", accentStroke: "#c7d2fe",
    secret: "#7d4e00", secretFill: "#fff8c5", secretStroke: "#d4a72c",
    badge: "#4f46e5", badgeText: "#ffffff",
  },
  dark: {
    text: "#e6edf3", muted: "#9198a1", line: "#768390",
    card: "#151b23", cardStroke: "#3d444d", panel: "#0f141a", panelStroke: "#3d444d",
    accent: "#a5b4fc", accentFill: "#1e1b4b", accentStroke: "#4f46e5",
    secret: "#e3b341", secretFill: "#2e2311", secretStroke: "#9e6a03",
    badge: "#6366f1", badgeText: "#ffffff",
  },
};

const font = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

// Simple line icons, 20 × 20, drawn at (x, y).
const icons = {
  browser: `<rect x="1" y="3" width="18" height="14" rx="2.5"/><path d="M1 7.5h18"/><circle cx="4.2" cy="5.25" r=".6" fill="currentColor" stroke="none"/><circle cx="6.4" cy="5.25" r=".6" fill="currentColor" stroke="none"/>`,
  page: `<path d="M5 1.5h7l4 4V18a.5.5 0 0 1-.5.5h-10.5A.5.5 0 0 1 4.5 18V2a.5.5 0 0 1 .5-.5z"/><path d="M12 1.5V5.5h4M7.5 10h5M7.5 13h5"/>`,
  functions: `<path d="M7 3.5C5 3.5 5 5 5 7s-1.5 3-2.5 3C3.5 10 5 11 5 13s0 3.5 2 3.5M13 3.5c2 0 2 1.5 2 3.5s1.5 3 2.5 3c-1 0-2.5 1-2.5 3s0 3.5-2 3.5"/>`,
  lock: `<rect x="3.5" y="8.5" width="13" height="10" rx="2"/><path d="M6.5 8.5V6a3.5 3.5 0 0 1 7 0v2.5M10 12.5v2"/>`,
  sparkle: `<path d="M10 1.5c.6 4.4 2.6 6.9 7.5 8.5-4.9 1.6-6.9 4.1-7.5 8.5-.6-4.4-2.6-6.9-7.5-8.5 4.9-1.6 6.9-4.1 7.5-8.5z"/>`,
  database: `<ellipse cx="10" cy="4.5" rx="7" ry="2.75"/><path d="M3 4.5v11c0 1.5 3.1 2.75 7 2.75s7-1.25 7-2.75v-11M3 10c0 1.5 3.1 2.75 7 2.75s7-1.25 7-2.75"/>`,
  type: `<path d="M3 17 8 3.5h1L14 17M4.6 12.5h7.8M14.5 17v-6.2a2.7 2.7 0 0 1 5 0V17"/>`,
};

function icon(name, x, y, color) {
  return `<g transform="translate(${x} ${y})" fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" color="${color}">${icons[name]}</g>`;
}

function text(x, y, content, { size = 14, weight = 400, color, anchor = "start" }) {
  return `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${color}" text-anchor="${anchor}">${content}</text>`;
}

/** A card: icon, title and up to three lines of detail. */
function card(t, { x, y, width, height, iconName, title, lines, fill = t.card, stroke = t.cardStroke, titleColor = t.text, iconColor = t.accent, detailColor = t.muted }) {
  return [
    `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="12" fill="${fill}" stroke="${stroke}"/>`,
    icon(iconName, x + 18, y + 18, iconColor),
    text(x + 48, y + 33, title, { size: 15, weight: 600, color: titleColor }),
    ...lines.map((line, index) => text(x + 18, y + 62 + index * 20, line, { size: 13, color: detailColor })),
  ].join("\n");
}

/** A straight arrow with a numbered step and a label above it. */
function arrow(t, { x1, y, x2, step, label }) {
  const middle = (x1 + x2) / 2;
  return [
    `<path d="M${x1} ${y}H${x2 - 7}" stroke="${t.line}" stroke-width="1.5" fill="none"/>`,
    `<path d="M${x2 - 8} ${y - 4.5}L${x2} ${y}L${x2 - 8} ${y + 4.5}z" fill="${t.line}"/>`,
    `<circle cx="${middle}" cy="${y}" r="10" fill="${t.badge}"/>`,
    text(middle, y + 4.5, String(step), { size: 12, weight: 700, color: t.badgeText, anchor: "middle" }),
    ...label.map((line, index) => text(middle, y - 20 - (label.length - 1 - index) * 16, line, { size: 12.5, color: t.muted, anchor: "middle" })),
  ].join("\n");
}

function diagram(t) {
  const parts = [
    // User side
    card(t, { x: 40, y: 110, width: 240, height: 150, iconName: "browser", title: "Prohlížeč", lines: ["Stránka Role Lab", "Pokrok a odznaky jen", "v tomto prohlížeči"] }),
    `<path d="M160 260V318" stroke="${t.line}" stroke-width="1.5" stroke-dasharray="4 4"/>`,
    card(t, { x: 40, y: 318, width: 240, height: 54, iconName: "type", title: "Google Fonts", lines: [], iconColor: t.muted }),

    // Vercel
    `<rect x="350" y="30" width="460" height="500" rx="16" fill="${t.panel}" stroke="${t.panelStroke}"/>`,
    text(372, 62, "Vercel", { size: 16, weight: 700, color: t.text }),
    text(434, 62, "· hosting a serverové funkce", { size: 13, color: t.muted }),

    card(t, { x: 372, y: 84, width: 416, height: 86, iconName: "page", title: "Statická stránka", lines: ["Jeden soubor index.html, Content Security Policy"] }),

    `<rect x="372" y="196" width="416" height="138" rx="12" fill="${t.card}" stroke="${t.cardStroke}"/>`,
    icon("functions", 390, 214, t.accent),
    text(420, 229, "Serverové funkce", { size: 15, weight: 600, color: t.text }),
    ...["/api/chat", "/api/evaluate", "/api/feedback"].flatMap((name, index) => {
      const x = 390 + index * 132;
      return [
        `<rect x="${x}" y="254" width="120" height="34" rx="8" fill="${t.accentFill}" stroke="${t.accentStroke}"/>`,
        `<text x="${x + 60}" y="275.5" font-size="13" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" fill="${t.accent}" text-anchor="middle">${name}</text>`,
      ];
    }),
    text(390, 316, "Ověří původ, limity a citace, spočítá úroveň", { size: 13, color: t.muted }),

    `<path d="M580 382V342" stroke="${t.secretStroke}" stroke-width="1.5" stroke-dasharray="4 4"/>`,
    `<path d="M575.5 349L580 341L584.5 349z" fill="${t.secretStroke}"/>`,
    card(t, {
      x: 372, y: 382, width: 416, height: 126, iconName: "lock", title: "Jen na serveru",
      lines: ["API klíč k Anthropicu", "Pokyny pro asistenta a hodnotitele", "Klíč hodnotitele, asistent ho nikdy nedostane"],
      fill: t.secretFill, stroke: t.secretStroke, titleColor: t.secret, iconColor: t.secret, detailColor: t.secret,
    }),

    // External services
    card(t, { x: 900, y: 150, width: 260, height: 112, iconName: "sparkle", title: "Anthropic API", lines: ["Asistent: Claude Sonnet", "Hodnotitel: Claude Opus"] }),
    card(t, { x: 900, y: 292, width: 260, height: 112, iconName: "database", title: "Upstash Redis", lines: ["Denní limity na osobu i celkem", "Zpětná vazba"] }),

    // Flows
    arrow(t, { x1: 280, y: 140, x2: 372, step: 1, label: ["načte"] }),
    arrow(t, { x1: 280, y: 230, x2: 372, step: 2, label: ["zprávy,", "odevzdání"] }),
    arrow(t, { x1: 788, y: 222, x2: 900, step: 3, label: ["volání modelu"] }),
    arrow(t, { x1: 788, y: 312, x2: 900, step: 4, label: ["počítadla"] }),
  ];

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="560" viewBox="0 0 1200 560" font-family="${font}" role="img" aria-label="Schéma infrastruktury Role Lab: prohlížeč, Vercel se statickou stránkou a serverovými funkcemi, Anthropic API a Upstash Redis">
${parts.join("\n")}
</svg>
`;
}

for (const [name, theme] of Object.entries(themes)) {
  const path = join(outputFolder, `architecture-${name}.svg`);
  writeFileSync(path, diagram(theme));
  console.log(`Written ${path}`);
}
