import { describe, expect, it } from "vitest";
import { apiHeaders } from "./apiHeaders";

describe("headers for the project's server", () => {
  it("send the same random browser number on every call", () => {
    const first = apiHeaders()["x-role-lab-browser"];
    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(apiHeaders()["x-role-lab-browser"]).toBe(first);
    expect(apiHeaders()["content-type"]).toBe("application/json");
  });
});
