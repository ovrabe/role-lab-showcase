import type { RoleConfig } from "../roles/roleSchema.js";
import type { TranscriptItem } from "../session/sessionSchema.js";
import { EvaluatorOutput, type Evidence, type StoredEvaluation } from "./evaluationSchema.js";
import { quoteAppearsIn } from "./verifyQuote.js";

export type EvaluatorKeyTrap = { id: string; title: string };

export type ValidationResult =
  | { ok: true; evaluation: StoredEvaluation }
  // The reply cannot be used at all; the person is offered "Zkusit znovu".
  | { ok: false; problems: string[] };

/**
 * Turns the raw reply from sample.json into a stored evaluation:
 * schema check, semantic checks the schema cannot express, and quote verification.
 * Problems that make the result unusable reject it; smaller ones become review flags.
 */
export function validateEvaluation(
  raw: unknown,
  role: RoleConfig,
  keyTraps: EvaluatorKeyTrap[],
  transcript: TranscriptItem[],
  submission: string,
  reflection: string,
): ValidationResult {
  const parsed = EvaluatorOutput.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      problems: parsed.error.issues.map((issue) => `${issue.path.join(".") || "(celá odpověď)"}: ${issue.message}`),
    };
  }
  const output = parsed.data;

  // Every rubric dimension exactly once, otherwise no level can be computed.
  const dimensionIds = output.dimensions.map((dimension) => dimension.id);
  const missing = role.rubric.filter((dimension) => !dimensionIds.includes(dimension.id));
  const duplicated = dimensionIds.filter((id, index) => dimensionIds.indexOf(id) !== index);
  if (missing.length > 0 || duplicated.length > 0) {
    return {
      ok: false,
      problems: [
        ...missing.map((dimension) => `Chybí dimenze ${dimension.id}.`),
        ...duplicated.map((id) => `Dimenze ${id} je v odpovědi víckrát.`),
      ],
    };
  }
  // Keep the rubric's order, so the result screen is the same every time.
  output.dimensions.sort(
    (a, b) =>
      role.rubric.findIndex((dimension) => dimension.id === a.id) -
      role.rubric.findIndex((dimension) => dimension.id === b.id),
  );

  const codeReviewFlags: string[] = [];

  // Traps: keep only those from the key, in the key's order; a missing one is a flag.
  const knownTraps = keyTraps
    .map((trap) => output.traps.find((evaluated) => evaluated.id === trap.id))
    .filter((trap) => trap !== undefined);
  for (const trap of keyTraps) {
    if (!output.traps.some((evaluated) => evaluated.id === trap.id)) {
      codeReviewFlags.push(`Hodnotitel neuvedl, zda byla zachycena záludnost „${trap.title}“.`);
    }
  }
  output.traps = knownTraps;

  const verify = (evidence: Evidence) => {
    if (evidence.turn === "submission" || evidence.turn === "reflection") {
      if (quoteAppearsIn(evidence.quote, submission)) {
        evidence.turn = "submission";
        return true;
      }
      // The prompt's schema has no place for the process comment, so the evaluator labels
      // quotes from it as "submission". A verbatim quote is genuine: keep it, fix the place.
      if (reflection.trim() !== "" && quoteAppearsIn(evidence.quote, reflection)) {
        evidence.turn = "reflection";
        return true;
      }
      return false;
    }
    const item = transcript.find((candidate) => candidate.turn === evidence.turn);
    return item !== undefined && quoteAppearsIn(evidence.quote, item.content);
  };
  const dimensionQuotesVerified = output.dimensions.map((dimension) => dimension.evidence.map(verify));
  const trapQuotesVerified = output.traps.map((trap) => trap.evidence.map(verify));

  const unverifiedCount = [...dimensionQuotesVerified, ...trapQuotesVerified].flat().filter((ok) => !ok).length;
  if (unverifiedCount > 0) {
    codeReviewFlags.push(
      unverifiedCount === 1
        ? "Jedna citace se v záznamu ani v odevzdání nenašla. Zkontroluj ji."
        : `${unverifiedCount} citací se v záznamu ani v odevzdání nenašlo. Zkontroluj je.`,
    );
  }

  // Each score needs a quote or an explicit "not enough evidence" (docs/SPEC.md, M3).
  for (const dimension of output.dimensions) {
    if (dimension.evidence.length === 0 && !output.insufficientEvidence.includes(dimension.id)) {
      const name = role.rubric.find((rubricDimension) => rubricDimension.id === dimension.id)?.name ?? dimension.id;
      codeReviewFlags.push(`Dimenze ${name} nemá citaci ani označení „nedostatek podkladů“.`);
    }
  }

  return {
    ok: true,
    evaluation: {
      output,
      dimensionQuotesVerified,
      trapQuotesVerified,
      codeReviewFlags,
      evaluatedAt: new Date().toISOString(),
    },
  };
}
