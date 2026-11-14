import { afterEach, describe, expect, it, vi } from "vitest";
import { handleFeedback, memoryFeedbackStore, upstashFeedbackStore, type FeedbackStore } from "./feedback";
import { memoryCounter, type RateLimiter } from "./rateLimit";

const limits = { perPerson: { chat: 1, evaluate: 1, feedback: 2 }, total: { chat: 1, evaluate: 1, feedback: 3 } };

function setup(store = memoryFeedbackStore()) {
  const limiter: RateLimiter = { counter: memoryCounter(), secret: "test", limits };
  return { deps: { feedback: store as FeedbackStore, limiter }, store };
}

const send = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("http://localhost/api/feedback", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost", "x-real-ip": "1.1.1.1", ...headers },
    body: JSON.stringify(body),
  });

describe("POST /api/feedback", () => {
  afterEach(() => vi.restoreAllMocks());

  it("saves the note with the optional contact and page, without the IP address", async () => {
    const { deps, store } = setup();
    const response = await handleFeedback(send({ message: "  Hezké!  ", contact: "linkedin.com/in/x", page: "result" }), deps);
    expect(response.status).toBe(200);
    expect(store.entries).toHaveLength(1);
    expect(store.entries[0]).toMatchObject({ kind: "note", message: "Hezké!", contact: "linkedin.com/in/x", page: "result" });
    expect(JSON.stringify(store.entries[0])).not.toContain("1.1.1.1");
  });

  it.each([
    ["an empty note", { message: "   " }],
    ["a note that is too long", { message: "x".repeat(2_001) }],
    ["a contact that is too long", { message: "ok", contact: "x".repeat(201) }],
    ["something that is not a note", { text: "ok" }],
  ])("rejects %s without saving", async (_name, body) => {
    const { deps, store } = setup();
    expect((await handleFeedback(send(body), deps)).status).toBe(400);
    expect(store.entries).toHaveLength(0);
  });

  it("accepts notes only from our own page", async () => {
    const { deps, store } = setup();
    expect((await handleFeedback(send({ message: "spam" }, { origin: "https://evil.example" }), deps)).status).toBe(403);
    expect(store.entries).toHaveLength(0);
  });

  it("limits notes per person and in total", async () => {
    const { deps, store } = setup();
    expect((await handleFeedback(send({ message: "1" }), deps)).status).toBe(200);
    expect((await handleFeedback(send({ message: "2" }), deps)).status).toBe(200);
    expect((await handleFeedback(send({ message: "3" }), deps)).status).toBe(429);
    expect((await handleFeedback(send({ message: "4" }, { "x-real-ip": "2.2.2.2" }), deps)).status).toBe(200);
    expect((await handleFeedback(send({ message: "5" }, { "x-real-ip": "3.3.3.3" }), deps)).status).toBe(429);
    expect(store.entries.map((entry) => (entry.kind === "note" ? entry.message : ""))).toEqual(["4", "2", "1"]);
  });

  it("saves a rating of the evaluation with the scores, but nothing from the task", async () => {
    const { deps, store } = setup();
    const body = {
      kind: "evaluation",
      rating: "rather_no",
      disagree: ["verification"],
      comment: "Ověřoval jsem data ve zprávě 3.",
      roleId: "category-manager",
      level: 2,
      scores: { framing: 3, decomposition: 2, verification: 1, iteration: 2, judgment: 2 },
      transcript: [{ content: "tajné" }],
    };
    expect((await handleFeedback(send(body), deps)).status).toBe(200);
    expect(store.entries[0]).toMatchObject({ kind: "evaluation", rating: "rather_no", disagree: ["verification"], level: 2 });
    expect(JSON.stringify(store.entries[0])).not.toContain("tajné");
  });

  it.each([
    ["an unknown rating", { rating: "maybe" }],
    ["an unknown area", { disagree: ["charisma"] }],
    ["a score out of range", { scores: { framing: 7 } }],
  ])("rejects a rating with %s", async (_name, change) => {
    const { deps, store } = setup();
    const body = { kind: "evaluation", rating: "yes", disagree: [], roleId: "category-manager", level: 2, scores: { framing: 2 }, ...change };
    expect((await handleFeedback(send(body), deps)).status).toBe(400);
    expect(store.entries).toHaveLength(0);
  });

  it("reports a store failure instead of pretending the note was saved", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const failing: FeedbackStore = { save: async () => Promise.reject(new Error("down")) };
    const { deps } = setup(failing as ReturnType<typeof memoryFeedbackStore>);
    expect((await handleFeedback(send({ message: "ok" }), deps)).status).toBe(503);
  });
});

describe("upstashFeedbackStore", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("adds the note to the list and keeps only the newest 500", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify([{ result: 1 }, { result: "OK" }])));
    vi.stubGlobal("fetch", fetchMock);
    await upstashFeedbackStore("https://example.upstash.io", "t").save({ kind: "note", message: "ok", at: "2026-11-11T10:00:00.000Z" });
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual([
      ["LPUSH", "feedback", JSON.stringify({ kind: "note", message: "ok", at: "2026-11-11T10:00:00.000Z" })],
      ["LTRIM", "feedback", "0", "499"],
    ]);
  });
});
