import { addMetrics, measureCall } from "./metrics.js";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { buildGeneratorPrompt } from "../src/customTask/generatorPrompt.js";
import { checkGeneratedTask, publicPart, type PublicGeneratedTask } from "../src/customTask/generatedTask.js";
import { asClaudeError, parseJsonReply, type HandlerDeps } from "./handlers.js";
import { badRequest, json, limitResponse, readJson } from "./http.js";
import { handleClaudeFailure } from "./claudeFailure.js";
import { budgetResponse, recordSpend } from "./spendBudget.js";
import { giveBackToLimit } from "./rateLimit.js";
import type { CustomTaskStore } from "./customTaskStore.js";
import { hasBlockingData } from "../src/customTask/sensitiveData.js";
import { countCustomTask } from "./statsHandler.js";

/**
 * POST /api/custom-task (docs/SPEC.md, section 14): a description in, a generated task out.
 * The browser sends only what the person saw in the preview. The server builds the generator's
 * instructions, checks the answer (the trap must really be in the table), stores the task for
 * 30 days and returns it without the trap.
 */

// The same limits as the form (src/screens/CustomTaskScreen.tsx), plus room for the table summary.
const CustomTaskRequest = z.object({
  role: z.string().trim().min(3).max(80),
  situation: z.string().trim().min(40).max(1500),
  deliverable: z.string().trim().max(500),
  data: z.string().trim().max(4000).nullable(),
});

export type CustomTaskResponse =
  | { kind: "ok"; id: string; task: PublicGeneratedTask }
  | { kind: "invalid"; problems: string[] }
  | { kind: "error"; code: string; message: string };

export type CustomTaskDeps = HandlerDeps & { customTasks: CustomTaskStore };

/** The description as the generator gets it: the same text the person saw in the preview. */
export function describeRequest(input: z.infer<typeof CustomTaskRequest>): string {
  return [`Role: ${input.role}`, `Situace: ${input.situation}`, `Co má výsledek obsahovat: ${input.deliverable || "neuvedeno"}`, input.data ? `\n${input.data}` : ""]
    .join("\n")
    .trim();
}

export async function handleCustomTask(request: Request, { claude, limiter, issues, customTasks }: CustomTaskDeps): Promise<Response> {
  const body = await readJson(request, 20_000);
  if (body instanceof Response) return body;
  const parsed = CustomTaskRequest.safeParse(body);
  if (!parsed.success) return badRequest("invalid_request", "Invalid custom task request.");
  if (!claude.generateCustomTask) return badRequest("unavailable", "Custom tasks are not available.", 503);
  // The page blocks these already; a request that skipped it is refused before anything is stored.
  if (hasBlockingData(describeRequest(parsed.data))) {
    await addMetrics(limiter.metrics, { "security.sensitive_data_blocked": 1 });
    return badRequest("sensitive_data", "The description contains personal data.");
  }

  if (await customTasks.isGenerationOff()) return badRequest("custom_tasks_off", "Custom tasks are switched off.", 503);
  const overBudget = await budgetResponse(limiter, request, issues);
  if (overBudget) return overBudget;
  const limited = await limitResponse(limiter, "customTask", request);
  if (limited) return limited;

  const prompt = buildGeneratorPrompt(describeRequest(parsed.data));
  // A reply that fails the checks gets one more try; the second failure returns the problems.
  let problems: string[] = [];
  const call = measureCall(limiter.metrics, "customTask");
  for (let attempt = 1; attempt <= 2; attempt++) {
    let reply: string;
    try {
      reply = await claude.generateCustomTask(prompt, {
        signal: request.signal,
        onUsage: (model, usage) => (call.usage(model, usage), recordSpend(limiter, request, model, usage)),
      });
    } catch (error) {
      const failure = asClaudeError(error);
      await handleClaudeFailure({ limiter, issues }, "customTask", request, failure);
      await call.finish(failure.code);
      return json({ kind: "error", code: failure.code, message: failure.message } satisfies CustomTaskResponse);
    }
    const checked = checkGeneratedTask(parseJsonReply(reply));
    if (checked.ok) {
      const id = randomBytes(9).toString("base64url");
      try {
        await customTasks.save({ id, createdAt: new Date().toISOString(), input: parsed.data, task: checked.task });
      } catch (error) {
        console.error("Custom task store failed:", error);
        return badRequest("service_unavailable", "Could not store the task.", 503);
      }
      await countCustomTask(limiter, "generated");
      await call.finish("ok");
      return json({ kind: "ok", id, task: publicPart(checked.task) } satisfies CustomTaskResponse);
    }
    problems = checked.problems;
    // Why the generator's answer was refused: shows which instruction it keeps breaking.
    for (const problem of problems) call.add(`customTask.rejected.${problem.split(":")[0]}`);
    console.warn(`Custom task attempt ${attempt} rejected: ${problems.join(", ")}`);
  }
  await call.finish("rejected");
  // Our generator failed, not the person: the day's single attempt is given back.
  await giveBackToLimit(limiter, "customTask", request);
  return json({ kind: "invalid", problems } satisfies CustomTaskResponse);
}
