import { afterEach, describe, expect, it, vi } from "vitest";
import { githubIssueTracker, memoryIssueTracker } from "./issues";

afterEach(() => vi.restoreAllMocks());

function mockFetch(status: number, body: unknown = {}) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(body), { status }));
}

describe("githubIssueTracker", () => {
  it("creates the issue in the given repository with the token, title, body and labels", async () => {
    const fetchMock = mockFetch(201, { number: 7 });
    await githubIssueTracker("test-token", "owner/repo").create({ title: "Chyba", body: "Popis", labels: ["testování"] });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.github.com/repos/owner/repo/issues");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer test-token");
    expect(JSON.parse(init.body as string)).toEqual({ title: "Chyba", body: "Popis", labels: ["testování"] });
  });

  it("shortens a title and a body that are too long", async () => {
    const fetchMock = mockFetch(201);
    await githubIssueTracker("t", "o/r").create({ title: "x".repeat(500), body: "y".repeat(50_000), labels: [] });
    const sent = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(sent.title).toHaveLength(120);
    expect(sent.body.startsWith("y".repeat(20_000))).toBe(true);
    expect(sent.body).toContain("zkráceno, celé znění je uložené v Upstash");
    expect(sent.body.length).toBeLessThan(20_100);
  });

  it.each([401, 403, 404, 422, 500])("fails on status %i without putting the token or GitHub's reply in the error", async (status) => {
    mockFetch(status, { message: "Bad credentials for test-token" });
    const creating = githubIssueTracker("test-token", "o/r").create({ title: "a", body: "b", labels: [] });
    await expect(creating).rejects.toThrow(`status ${status}`);
    await creating.catch((error: Error) => expect(error.message).not.toContain("test-token"));
  });

  it("fails when GitHub cannot be reached", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("fetch failed"));
    await expect(githubIssueTracker("t", "o/r").create({ title: "a", body: "b", labels: [] })).rejects.toThrow();
  });
});

describe("memoryIssueTracker", () => {
  it("keeps the newest issue first", async () => {
    const tracker = memoryIssueTracker();
    await tracker.create({ title: "první", body: "", labels: [] });
    await tracker.create({ title: "druhý", body: "", labels: [] });
    expect(tracker.issues.map((issue) => issue.title)).toEqual(["druhý", "první"]);
  });
});
