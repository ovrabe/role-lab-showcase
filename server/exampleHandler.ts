import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { EvaluatorOutput } from "../src/evaluation/evaluationSchema.js";
import { TranscriptItem } from "../src/session/sessionSchema.js";
import { strongExampleFrom, type StrongExample } from "../src/result/strongExample.js";
import type { ServerContent } from "./content.js";
import { badRequest, json, limitResponse, readJson } from "./http.js";
import type { RateLimiter } from "./rateLimit.js";

/**
 * The strong sample of a task for the result screen (src/result/strongExample.ts).
 * Samples reveal the traps, so the web page does not contain them; the page asks for one only
 * after its own evaluation. No Claude call; a daily limit still keeps scripts from hammering it.
 */
const ExampleRequest = z.object({ roleId: z.string().max(60) });
const Fixture = z.object({ roleId: z.string(), transcript: z.array(TranscriptItem), submission: z.string(), evaluation: EvaluatorOutput });

export type ExampleResponse = { kind: "ok"; example: StrongExample } | { kind: "none" };

export async function handleExample(
  request: Request,
  { content, limiter, root = process.cwd() }: { content: ServerContent; limiter: RateLimiter; root?: string },
): Promise<Response> {
  const body = await readJson(request, 1_000);
  if (body instanceof Response) return body;
  const parsed = ExampleRequest.safeParse(body);
  if (!parsed.success) return badRequest("invalid_request", "Invalid example request.");
  // Only a task that exists: the id becomes part of a file path.
  const role = content.roles.activeRoles.find((candidate) => candidate.id === parsed.data.roleId);
  if (!role) return badRequest("unknown_role", "Unknown role.");
  const limited = await limitResponse(limiter, "example", request);
  if (limited) return limited;

  const path = join(root, "fixtures", `${role.id}.preview-strong.json`);
  if (!existsSync(path)) return json({ kind: "none" } satisfies ExampleResponse);
  const fixture = Fixture.safeParse(JSON.parse(readFileSync(path, "utf8")));
  if (!fixture.success || fixture.data.roleId !== role.id) return json({ kind: "none" } satisfies ExampleResponse);
  return json({ kind: "ok", example: strongExampleFrom(fixture.data, fixture.data.evaluation) } satisfies ExampleResponse);
}
