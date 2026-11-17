import type { RoleConfig } from "../roles/roleSchema";
import type { StoredEvaluation } from "../evaluation/evaluationSchema";

/**
 * A personal card to download after an evaluation: role, task, level, two strengths and two
 * next steps, as a PNG drawn on a canvas in the browser (no library, nothing sent anywhere).
 * Portrait 1080 × 1350, the size social networks show without cropping.
 */
export type CardContent = {
  roleTitle: string;
  taskTitle: string;
  level: number;
  levelLabel: string;
  levelCount: number;
  strengths: string[];
  nextSteps: string[];
  date: Date;
};

export function cardContent(role: RoleConfig, evaluation: StoredEvaluation, level: { level: number; label: string }): CardContent {
  return {
    roleTitle: role.title,
    taskTitle: role.taskTitle,
    level: level.level,
    levelLabel: level.label,
    levelCount: role.levels.length,
    strengths: evaluation.output.strengths.slice(0, 2),
    nextSteps: evaluation.output.nextSteps.slice(0, 2).map((step) => step.title),
    date: new Date(evaluation.evaluatedAt),
  };
}

const width = 1080;
const height = 1350;
const margin = 88;
const ink = "#1d1b2b";
const muted = "#5e5b72";
const accent = "#5a37b8";

// Splits text into lines that fit `maxWidth`, at most `maxLines`, the last one ending in "…" when cut.
function wrap(context: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const candidate = line ? `${line} ${word}` : word;
    if (context.measureText(candidate).width <= maxWidth) {
      line = candidate;
      continue;
    }
    lines.push(line);
    line = word;
    if (lines.length === maxLines) break;
  }
  if (lines.length < maxLines && line) lines.push(line);
  else if (lines.length === maxLines && line) {
    let last = lines[maxLines - 1];
    while (context.measureText(`${last}…`).width > maxWidth && last.includes(" ")) last = last.slice(0, last.lastIndexOf(" "));
    lines[maxLines - 1] = `${last}…`;
  }
  return lines;
}

export async function drawResultCard(content: CardContent, fontFamily: string): Promise<Blob> {
  await document.fonts?.ready;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d")!;
  const font = (weight: number, size: number) => `${weight} ${size}px ${fontFamily}`;

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);

  // Header in the colours of the home banner, with the same waves along its bottom edge.
  const headerHeight = 440;
  const gradient = context.createLinearGradient(0, 0, width, headerHeight);
  gradient.addColorStop(0, "#241d5c");
  gradient.addColorStop(0.55, "#3a2a8a");
  gradient.addColorStop(1, "#5a37b8");
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, headerHeight);
  const waves = context.createLinearGradient(0, headerHeight, width, headerHeight - 120);
  waves.addColorStop(0, "#ff7a45");
  waves.addColorStop(0.45, "#e5489b");
  waves.addColorStop(1, "#8a5cf6");
  context.fillStyle = waves;
  context.beginPath();
  context.moveTo(0, headerHeight);
  context.bezierCurveTo(260, headerHeight - 6, 420, headerHeight - 70, 660, headerHeight - 76);
  context.bezierCurveTo(860, headerHeight - 80, 980, headerHeight - 110, width, headerHeight - 150);
  context.lineTo(width, headerHeight);
  context.closePath();
  context.fill();

  context.fillStyle = "rgba(255,255,255,0.8)";
  context.font = font(600, 30);
  context.fillText("Role Lab · práce s AI na úkolu z praxe", margin, 120);
  context.fillStyle = "#ffffff";
  context.font = font(600, 36);
  context.fillText(content.roleTitle, margin, 200);
  context.font = font(700, 58);
  wrap(context, content.taskTitle, width - 2 * margin, 2).forEach((line, index) => context.fillText(line, margin, 272 + index * 68));

  // The level, as on the result screen.
  // Worst case (two strengths and two steps, two lines each) ends at about y = 1215,
  // above the footer at 1290, so nothing overflows.
  let y = 620;
  context.fillStyle = ink;
  context.font = font(800, 150);
  context.fillText(String(content.level), margin, y);
  const numberWidth = context.measureText(String(content.level)).width;
  context.font = font(600, 44);
  context.fillStyle = muted;
  context.fillText(`ze ${content.levelCount}`, margin + numberWidth + 20, y);
  context.fillStyle = accent;
  context.font = font(700, 48);
  context.fillText(content.levelLabel, margin + numberWidth + 20, y - 62);

  function section(title: string, items: string[]) {
    if (items.length === 0) return;
    y += 90;
    context.fillStyle = muted;
    context.font = font(700, 30);
    context.fillText(title.toUpperCase(), margin, y);
    context.font = font(500, 36);
    for (const item of items) {
      const lines = wrap(context, item, width - 2 * margin - 44, 2);
      y += 58;
      context.fillStyle = accent;
      context.beginPath();
      context.arc(margin + 10, y - 13, 9, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = ink;
      lines.forEach((line, index) => context.fillText(line, margin + 44, y + index * 46));
      y += (lines.length - 1) * 46;
    }
  }
  section("Co ti jde", content.strengths);
  section("Příště zkus", content.nextSteps);

  context.fillStyle = muted;
  context.font = font(500, 28);
  const date = content.date.toLocaleDateString("cs-CZ", { day: "numeric", month: "long", year: "numeric" });
  context.fillText(`${date} · role-lab-gamma.vercel.app`, margin, height - 60);

  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Card could not be drawn"))), "image/png"));
}
