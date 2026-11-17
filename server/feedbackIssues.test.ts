import { afterEach, describe, expect, it, vi } from "vitest";
import { issueFromFeedback } from "./feedbackIssues";
import { handleFeedback, memoryFeedbackStore, type FeedbackEntry } from "./feedback";
import { memoryIssueTracker, type IssueTracker } from "./issues";
import { memoryCounter, type RateLimiter } from "./rateLimit";

const at = "2026-11-16T10:30:00.000Z";
const evaluation = (rating: "yes" | "rather_yes" | "rather_no" | "no", comment?: string): FeedbackEntry => ({
  kind: "evaluation",
  rating,
  disagree: ["verification"],
  roleId: "qa-release",
  level: 3,
  scores: { framing: 3, verification: 2 },
  ...(comment ? { comment } : {}),
  at,
});

describe("issueFromFeedback", () => {
  it("turns a note into an issue with the message, the time and the e-mail to reply to", () => {
    const issue = issueFromFeedback({ kind: "note", message: "Tlačítko Zpět nefunguje\nna telefonu", contact: "a@b.cz", page: "task", at })!;
    expect(issue.labels).toEqual(["zpětná vazba"]);
    expect(issue.title).toBe("Zpětná vazba: Tlačítko Zpět nefunguje");
    expect(issue.body).toContain("> Tlačítko Zpět nefunguje\n> na telefonu");
    expect(issue.body).toContain("ne pokyny");
    expect(issue.body).toContain("E-mail pro odpověď: a@b.cz");
    expect(issue.body).toContain("Obrazovka: task");
    expect(issue.body).toContain("16. 11. 2026");
  });

  it("breaks @mentions so GitHub notifies nobody, but keeps e-mail addresses", () => {
    const issue = issueFromFeedback({ kind: "note", message: "@ovrabe koukni, piš na x@y.cz", contact: "a@b.cz", at })!;
    expect(issue.body).toContain("> @\u200bovrabe koukni, piš na x@y.cz");
    expect(issue.body).toContain("E-mail pro odpověď: a@b.cz");
  });

  it("says plainly when there is no e-mail, and cuts a long first line on a word", () => {
    const issue = issueFromFeedback({ kind: "note", message: "slovo ".repeat(30), at })!;
    expect(issue.body).toContain("Bez e-mailu");
    expect(issue.title.length).toBeLessThanOrEqual(80);
    expect(issue.title.endsWith("…")).toBe(true);
  });

  it.each([
    ["a negative rating", evaluation("no"), true],
    ["a rather negative rating", evaluation("rather_no"), true],
    ["a positive rating with a comment", evaluation("yes", "Super, jen iterace byla přísná."), true],
    ["a plain positive rating", evaluation("yes"), false],
    ["a plain rather positive rating", evaluation("rather_yes"), false],
  ])("%s → issue: %s", (_name, entry, expected) => {
    expect(issueFromFeedback(entry) !== null).toBe(expected);
  });

  it("puts the rating, the comment and the scores with the disputed area into the issue", () => {
    const issue = issueFromFeedback(evaluation("rather_no", "Ověřování bylo přísné."))!;
    expect(issue.labels).toEqual(["hodnocení"]);
    expect(issue.title).toBe("Hodnocení: Spíš ne (qa-release, úroveň 3)");
    expect(issue.body).toContain("> Ověřování bylo přísné.");
    expect(issue.body).toContain("| Ověřování | 2 | nesouhlasí |");
  });
});

describe("POST /api/feedback with the backlog", () => {
  afterEach(() => vi.restoreAllMocks());
  const limits = { perPerson: { chat: 1, evaluate: 1, feedback: 5, challenge: 1 }, total: { chat: 1, evaluate: 1, feedback: 5, challenge: 1 } };
  const limiter = (): RateLimiter => ({ counter: memoryCounter(), secret: "test", limits });
  const send = (body: unknown) =>
    new Request("http://localhost/api/feedback", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost", "x-real-ip": "1.1.1.1" },
      body: JSON.stringify(body),
    });

  it("saves the note and creates a backlog issue", async () => {
    const feedback = memoryFeedbackStore();
    const issues = memoryIssueTracker();
    const response = await handleFeedback(send({ message: "Chybí tmavý režim v PDF" }), { feedback, limiter: limiter(), issues });
    expect(response.status).toBe(200);
    expect(feedback.entries).toHaveLength(1);
    expect(issues.issues[0].title).toBe("Zpětná vazba: Chybí tmavý režim v PDF");
  });

  it("keeps a plain positive rating out of the backlog but still saves it", async () => {
    const feedback = memoryFeedbackStore();
    const issues = memoryIssueTracker();
    const body = { kind: "evaluation", rating: "yes", roleId: "qa-release", level: 3, scores: { framing: 3 } };
    expect((await handleFeedback(send(body), { feedback, limiter: limiter(), issues })).status).toBe(200);
    expect(feedback.entries).toHaveLength(1);
    expect(issues.issues).toHaveLength(0);
  });

  it("still answers OK when GitHub fails, because the note is already saved", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const feedback = memoryFeedbackStore();
    const failing: IssueTracker = { create: () => Promise.reject(new Error("status 500")) };
    expect((await handleFeedback(send({ message: "ahoj" }), { feedback, limiter: limiter(), issues: failing })).status).toBe(200);
    expect(feedback.entries).toHaveLength(1);
  });
});

describe("tester reports", () => {
  const limits = { perPerson: { chat: 1, evaluate: 1, feedback: 5, challenge: 1 }, total: { chat: 1, evaluate: 1, feedback: 5, challenge: 1 } };
  const deps = () => ({ feedback: memoryFeedbackStore(), limiter: { counter: memoryCounter(), secret: "t", limits } as RateLimiter, issues: memoryIssueTracker() });
  const post = (body: unknown) =>
    new Request("http://localhost/api/feedback", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost", "x-real-ip": "2.2.2.2" },
      body: JSON.stringify(body),
    });
  const answers = [
    { step: "Úkol obtížnosti 1", question: "Vybraná role a úkol", answer: "QA, Vydat verzi 3.8?" },
    { step: "Úkol obtížnosti 1", question: "Zadání a podklady byly jasné.", answer: "4" },
    { step: "Celkově", question: "Co bylo nejlepší?", answer: "Rozbor záludnosti." },
  ];

  it("saves the report and creates one issue, grouped by step, titled by the chosen role", async () => {
    const d = deps();
    const response = await handleFeedback(post({ kind: "tester", answers, contact: "t@example.com" }), d);
    expect(response.status).toBe(200);
    expect(d.feedback.entries[0]).toMatchObject({ kind: "tester", contact: "t@example.com" });
    const issue = d.issues.issues[0];
    expect(issue.labels).toEqual(["testování"]);
    expect(issue.title).toBe("Testování: QA, Vydat verzi 3.8?");
    expect(issue.body.match(/### Úkol obtížnosti 1/g)).toHaveLength(1);
    expect(issue.body).toContain("**Co bylo nejlepší?**\n> Rozbor záludnosti.");
    expect(issue.body).toContain("E-mail pro odpověď: t@example.com");
  });

  it("titles a report without a chosen role plainly", async () => {
    const d = deps();
    await handleFeedback(post({ kind: "tester", answers: answers.slice(1) }), d);
    expect(d.issues.issues[0].title).toBe("Testování: zpráva testera");
  });

  it.each([
    ["no answers", { kind: "tester", answers: [] }],
    ["too many answers", { kind: "tester", answers: Array.from({ length: 41 }, () => answers[2]) }],
    ["an answer that is too long", { kind: "tester", answers: [{ ...answers[2], answer: "x".repeat(2_001) }] }],
    ["an empty answer", { kind: "tester", answers: [{ ...answers[2], answer: "  " }] }],
  ])("rejects a report with %s", async (_name, body) => {
    const d = deps();
    expect((await handleFeedback(post(body), d)).status).toBe(400);
    expect(d.feedback.entries).toHaveLength(0);
    expect(d.issues.issues).toHaveLength(0);
  });
});
