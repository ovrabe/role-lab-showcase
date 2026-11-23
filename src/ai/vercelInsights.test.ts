import { describe, expect, it } from "vitest";
import { sanitizeUrl } from "./vercelInsights";

describe("sanitizeUrl", () => {
  it("drops query values, so a shared task id never reaches Vercel", () => {
    expect(sanitizeUrl("https://role-lab-gamma.vercel.app/?vlastni-vyzva=e12MYcMAHwTT")).toBe("https://role-lab-gamma.vercel.app/?vlastni-vyzva");
    expect(sanitizeUrl("https://role-lab-gamma.vercel.app/?testovani#x")).toBe("https://role-lab-gamma.vercel.app/?testovani");
  });

  it("keeps campaign labels, but only short plain ones", () => {
    expect(sanitizeUrl("https://x.test/?utm_source=testeri&a=1")).toBe("https://x.test/?utm_source=testeri&a");
    expect(sanitizeUrl("https://x.test/?utm_source=jan.novak%40firma.cz")).toBe("https://x.test/?utm_source");
  });

  it("survives a broken address", () => {
    expect(sanitizeUrl("::")).toBe("/");
  });
});
