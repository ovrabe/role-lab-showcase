import { afterEach, describe, expect, it, vi } from "vitest";

// The fixed development admin token is public (this code is in the public copy), so it must
// open the admin only inside the Vite development server, never in any deployed build.

async function freshDeps(env: Record<string, string | undefined>) {
  vi.resetModules();
  for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value as string);
  const { getServerDeps, localAdminToken } = await import("./deps");
  const deps = getServerDeps();
  return { token: "misconfigured" in deps ? undefined : deps.adminToken, localAdminToken };
}

afterEach(() => vi.unstubAllEnvs());

describe("admin token", () => {
  it("uses the token from the settings whenever it is set", async () => {
    const { token } = await freshDeps({ ADMIN_TOKEN: "x".repeat(40), ROLE_LAB_DEV_SERVER: "1", VERCEL: "" });
    expect(token).toBe("x".repeat(40));
  });

  it("allows the development token only in the development server", async () => {
    const dev = await freshDeps({ ADMIN_TOKEN: "", ROLE_LAB_DEV_SERVER: "1", VERCEL: "" });
    expect(dev.token).toBe(dev.localAdminToken);
  });

  it("has no token at all elsewhere: another host, a preview build, a test", async () => {
    expect((await freshDeps({ ADMIN_TOKEN: "", ROLE_LAB_DEV_SERVER: "", VERCEL: "" })).token).toBeUndefined();
  });
});
