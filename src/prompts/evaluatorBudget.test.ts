import { describe, expect, it } from "vitest";
import { buildEvaluatorPrompt } from "./evaluator";
import { loadRoles } from "../roles/loadRoles";
import { getEvaluatorKey } from "../evaluation/evaluatorKeys";
import { maxPromptBytes } from "../assistant/promptBudget";
import { maxMessageChars, maxUserMessages } from "../assistant/limits";
import { TaskSession, type TranscriptItem } from "../session/sessionSchema";

const role = loadRoles().activeRoles.find((candidate) => candidate.id === "qa-release")!;
const key = getEvaluatorKey(role.id)!;
const bytesOf = (text: string) => new TextEncoder().encode(text).length;
const ts = "2026-11-17T10:00:00.000Z";

function sessionWith(transcript: TranscriptItem[]) {
  return TaskSession.parse({
    version: 1,
    roleId: role.id,
    startedAt: ts,
    submittedAt: "2026-11-17T10:15:00.000Z",
    transcript,
    submission: "Doporučuji vydání odložit.",
    lastSavedSubmission: "Doporučuji vydání odložit.",
    reflection: "",
  });
}

// 25 exchanges; the assistant answers with `answerChars` characters of Czech-like text each time.
function longConversation(questionChars: number, answerChars: number): TranscriptItem[] {
  const items: TranscriptItem[] = [];
  for (let index = 0; index < maxUserMessages; index++) {
    items.push({ turn: items.length + 1, kind: "user", content: `Otázka ${index} ` + "č".repeat(questionChars), ts });
    items.push({ turn: items.length + 1, kind: "assistant", content: `Odpověď ${index} ` + "ř".repeat(answerChars), ts });
  }
  return items;
}

describe("the evaluator prompt stays within one call", () => {
  it("leaves an ordinary attempt untouched", () => {
    const transcript: TranscriptItem[] = [
      { turn: 1, kind: "user", content: "Projdi výsledky testů.", ts },
      { turn: 2, kind: "assistant", content: "Ve výsledcích jsou tři přeskočené testy plateb.", ts },
    ];
    const prompt = buildEvaluatorPrompt(role, key, sessionWith(transcript));
    expect(prompt).toContain("[1] user (2026-11-17T10:00:00.000Z): Projdi výsledky testů.");
    expect(prompt).toContain("[2] assistant (2026-11-17T10:00:00.000Z): Ve výsledcích jsou tři přeskočené testy plateb.");
    expect(prompt).not.toContain("zkráceno pro hodnocení");
  });

  it("cuts the middle of long answers and keeps every message of the person whole", () => {
    const transcript = longConversation(300, 12_000);
    const prompt = buildEvaluatorPrompt(role, key, sessionWith(transcript));
    expect(bytesOf(prompt)).toBeLessThanOrEqual(maxPromptBytes);
    expect(prompt).toContain("[…zkráceno pro hodnocení…]");
    for (const item of transcript.filter((candidate) => candidate.kind === "user")) expect(prompt).toContain(item.content);
    // Beginning and end of an answer stay, so its gist and conclusion are still there.
    expect(prompt).toContain("Odpověď 7 řřř");
  });

  it("fits even the longest attempt the limits allow", () => {
    const prompt = buildEvaluatorPrompt(role, key, sessionWith(longConversation(maxMessageChars, 50_000)));
    expect(bytesOf(prompt)).toBeLessThanOrEqual(maxPromptBytes);
    expect(prompt).toContain("<odevzdani>Doporučuji vydání odložit.</odevzdani>");
  });
});
