import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import type { Plugin } from "vite";

/**
 * Web build only: the page font from our own domain instead of Google Fonts. Loading it from
 * Google sends every visitor's IP address to Google without consent, which a German court
 * found unlawful (LG München I, 2022). The claude.ai builds keep Google Fonts, the one outside
 * host the project rules allow there.
 * The files come from @fontsource/plus-jakarta-sans (OFL licence): the weights the page uses,
 * Latin and Latin Extended (Czech letters), each loaded only when the page shows such letters.
 */
const weights = [400, 500, 600];
const subsets = ["latin", "latin-ext"];

const packageDir = dirname(createRequire(import.meta.url).resolve("@fontsource/plus-jakarta-sans/package.json"));

// The package's own @font-face rules for one weight, with their unicode ranges, pointed at /fonts/.
function fontFaces(weight: number): string {
  const css = readFileSync(join(packageDir, `${weight}.css`), "utf8");
  return subsets
    .map((subset) => {
      const block = css.match(new RegExp(`/\\* plus-jakarta-sans-${subset}-${weight}-normal \\*/\\s*(@font-face \\{[^}]*\\})`))?.[1];
      if (!block) throw new Error(`Font face not found: ${subset} ${weight}`);
      return block.replace(/src: [^;]*;/, `src: url(/fonts/plus-jakarta-sans-${subset}-${weight}-normal.woff2) format('woff2');`);
    })
    .join("\n");
}

export function selfHostedFont(): Plugin {
  return {
    name: "self-hosted-font",
    apply: "build",
    transformIndexHtml(html) {
      const withoutGoogle = html.replace(/\s*<link\s[^>]*fonts\.(googleapis|gstatic)\.com[^>]*>/g, "");
      if (withoutGoogle.includes("fonts.g")) throw new Error("A Google Fonts link is left in index.html");
      return withoutGoogle.replace("</head>", `  <style>\n${weights.map(fontFaces).join("\n")}\n    </style>\n  </head>`);
    },
    generateBundle() {
      for (const weight of weights) {
        for (const subset of subsets) {
          const name = `plus-jakarta-sans-${subset}-${weight}-normal.woff2`;
          this.emitFile({ type: "asset", fileName: `fonts/${name}`, source: readFileSync(join(packageDir, "files", name)) });
        }
      }
    },
  };
}
