import { loadServerContent, type ServerContent } from "./content.js";
import { anthropicClient, type ClaudeClient } from "./claudeClient.js";
import { mockClaude } from "./mockClaude.js";
import { memoryCounter, upstashCounter, type RateLimiter } from "./rateLimit.js";
import { memoryFeedbackStore, upstashFeedbackStore, type FeedbackStore } from "./feedback.js";
import { githubIssueTracker, memoryIssueTracker, type IssueTracker } from "./issues.js";
import { memoryCustomTaskStore, upstashCustomTaskStore, type CustomTaskStore } from "./customTaskStore.js";

/**
 * What the endpoints need, created once per server instance. Secrets come only from the
 * environment (docs/PRODUCTION.md, section 3): set them in the Vercel project settings,
 * never in code or in a committed file.
 *
 * Locally, without a key the server uses the fake Claude and counts limits in memory.
 * On Vercel a missing API key or a missing counter store is a configuration error: the
 * endpoints refuse to answer instead of serving fake answers or running without limits.
 */
export type ServerDeps =
  | {
      content: ServerContent;
      claude: ClaudeClient;
      limiter: RateLimiter;
      feedback: FeedbackStore;
      // Where reports and feedback become backlog items. Optional: without it everything is
      // still saved in the feedback store, so a missing token loses nothing.
      issues: IssueTracker | null;
      // Generated custom tasks (docs/SPEC.md, section 14), kept 30 days.
      customTasks: CustomTaskStore;
    }
  | { misconfigured: string };

let cached: ServerDeps | undefined;

export function getServerDeps(): ServerDeps {
  if (cached) return cached;
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  // The Vercel Marketplace integration for Upstash has used both names over time.
  const storeUrl = (process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL)?.trim();
  const storeToken = (process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN)?.trim();
  const onVercel = Boolean(process.env.VERCEL);
  // A fine-grained GitHub token that can only create issues, and the repository, e.g. "owner/name".
  const issuesToken = process.env.GITHUB_ISSUES_TOKEN?.trim();
  const issuesRepository = process.env.GITHUB_ISSUES_REPO?.trim();

  if (onVercel && !apiKey) {
    cached = { misconfigured: "ANTHROPIC_API_KEY is not set for this deployment." };
  } else if (onVercel && !(storeUrl && storeToken)) {
    cached = { misconfigured: "Upstash Redis (UPSTASH_REDIS_REST_URL/TOKEN) is not connected, so daily limits cannot work." };
  } else {
    cached = {
      content: loadServerContent(),
      claude: apiKey ? anthropicClient(apiKey) : mockClaude,
      limiter: {
        counter: storeUrl && storeToken ? upstashCounter(storeUrl, storeToken) : memoryCounter(),
        // The API key is already a server-only secret; reusing it saves setting another one.
        secret: apiKey ?? "local-development",
      },
      feedback: storeUrl && storeToken ? upstashFeedbackStore(storeUrl, storeToken) : memoryFeedbackStore(),
      issues: issuesToken && issuesRepository ? githubIssueTracker(issuesToken, issuesRepository) : onVercel ? null : memoryIssueTracker(),
      customTasks: storeUrl && storeToken ? upstashCustomTaskStore(storeUrl, storeToken) : memoryCustomTaskStore(),
    };
  }
  return cached;
}

export function misconfiguredResponse(reason: string): Response {
  // The reason goes to the server log only; the page gets a generic code it can explain.
  console.error(reason);
  return new Response(JSON.stringify({ error: { code: "unavailable", message: "Server is not configured." } }), {
    status: 503,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
