import { isWebBuild } from "../buildFlags";

/**
 * Vercel Web Analytics and Speed Insights (web version only, docs/PRODUCTION.md, part 11):
 * where visitors come from, which devices and browsers, how fast the page loads. Both work
 * without cookies and without storing anything in the browser. The scripts come from our own
 * domain (/_vercel/...), never from a third-party address, so the page's Content Security
 * Policy only needs 'self'. They run only in the deployed build; the development mode of the
 * packages would load a debug script from Vercel's CDN.
 */

/**
 * The address Vercel gets: query values are dropped (?vlastni-vyzva=<id> would hand over the
 * link to someone's task), only the names stay, so ?testovani or ?jak-vznikl are still visible.
 * UTM values stay, they are the campaign labels the author puts into links on purpose.
 */
export function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const kept = [...parsed.searchParams].map(([name, value]) =>
      name.startsWith("utm_") && /^[\w.-]{1,40}$/.test(value) ? `${encodeURIComponent(name)}=${value}` : encodeURIComponent(name),
    );
    parsed.search = kept.length > 0 ? `?${kept.join("&")}` : "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return "/";
  }
}

export async function startVercelInsights(): Promise<void> {
  if (!isWebBuild || !import.meta.env.PROD) return;
  try {
    const [{ inject }, { injectSpeedInsights }] = await Promise.all([import("@vercel/analytics"), import("@vercel/speed-insights")]);
    const beforeSend = <T extends { url: string }>(event: T): T => ({ ...event, url: sanitizeUrl(event.url) });
    inject({ mode: "production", scriptSrc: "/_vercel/insights/script.js", beforeSend });
    injectSpeedInsights({ scriptSrc: "/_vercel/speed-insights/script.js", beforeSend });
  } catch {
    // Analytics is a convenience for the author; the page works without it.
  }
}
