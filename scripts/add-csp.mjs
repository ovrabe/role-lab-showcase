// Runs in `npm run build:web`, right after Vite. Adds a Content Security Policy to the web
// page (docs/PRODUCTION.md, section 3, point 11). The page is one self-contained file with
// inline scripts, so the policy allows exactly those scripts by their hash: if anything ever
// slipped a foreign script into the page, the browser would refuse to run it and it could
// not send data anywhere but our own server.
// The rest of the security headers (and frame-ancestors, which a meta tag cannot carry)
// are set in vercel.json.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const file = "dist-web/index.html";
let page = readFileSync(file, "utf8");

const scriptHashes = [...page.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(
  ([, content]) => `'sha256-${createHash("sha256").update(content, "utf8").digest("base64")}'`,
);
if (scriptHashes.length === 0) throw new Error("No inline script found in dist-web/index.html");

const policy = [
  "default-src 'self'",
  // 'self' only for Vercel Web Analytics and Speed Insights, which load their scripts from
  // our own domain (/_vercel/..., src/ai/vercelInsights.ts). Nothing else is served there.
  `script-src 'self' ${scriptHashes.join(" ")}`,
  // React sets some styles inline. The font comes from our own domain (scripts/selfHostedFont.ts).
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "img-src 'self' data: blob:",
  // Only the project's own server functions (/api/...).
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");

if (page.includes('http-equiv="Content-Security-Policy"')) throw new Error("CSP already present");
page = page.replace(/<meta charset="UTF-8"\s*\/?>/i, (charset) => `${charset}\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`);
if (!page.includes('http-equiv="Content-Security-Policy"')) throw new Error("Could not insert the CSP meta tag");

writeFileSync(file, page);
console.log(`CSP added: ${scriptHashes.length} inline script(s) allowed by hash.`);
