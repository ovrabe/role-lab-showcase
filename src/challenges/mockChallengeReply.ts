// A fake challenge evaluator for local development and tests (?simulace in the page, no API
// key on the server). Builds a valid reply from the prompt, so quotes really are in the answer.
// Triggers in the answer: "#chyba:rate_limited" (or another code) rejects with that code,
// "#spatny-tvar" returns JSON of a wrong shape.
export function mockChallengeReply(prompt: string): unknown {
  const answer = prompt.match(/<odpoved_na_vyzvu>([\s\S]*?)<\/odpoved_na_vyzvu>/)?.[1] ?? "";
  const errorCode = answer.match(/#chyba:(\w+)/)?.[1];
  if (errorCode) throw { code: errorCode, message: `Mock error ${errorCode}` };
  if (answer.includes("#spatny-tvar")) return { hodnoceni: "nevím" };

  const keyJson = prompt.match(/<klic>([\s\S]*?)<\/klic>/)?.[1] ?? "{}";
  const trapIds: string[] = (JSON.parse(keyJson).traps ?? []).map((trap: { id: string }) => trap.id);
  const firstWords = answer.trim().split(/\s+/).slice(0, 5).join(" ");
  // A longer answer scores higher, so every score can be tried without Claude.
  const score = answer.length < 80 ? 1 : answer.length < 200 ? 2 : 3;

  return {
    score,
    rationale: "Simulované odůvodnění, nejde o Clauda.",
    evidence: [{ quote: firstWords }],
    traps: trapIds.map((id, index) => ({
      id,
      status: index === 0 && score > 1 ? "caught" : "missed",
      quote: index === 0 && score > 1 ? firstWords : "",
    })),
    tip: "Tady bude konkrétní rada od hodnotitele. Teď běží simulace, nejde o Clauda.",
    humanReviewFlags: ["Simulované hodnocení, nejde o Clauda."],
  };
}
