/**
 * Runs Redis commands in Upstash as one transaction over its REST API
 * (https://upstash.com/docs/redis/features/restapi) and returns each command's result.
 * Plain fetch instead of an SDK: two short calls do not justify a dependency.
 */
export async function upstashTransaction(url: string, token: string, commands: string[][]): Promise<unknown[]> {
  const response = await fetch(`${url.replace(/\/$/, "")}/multi-exec`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(commands),
    // Every request waits for the counter first; a store that hangs must not hang the page.
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new Error(`Upstash HTTP ${response.status}`);
  const results = (await response.json()) as { result?: unknown; error?: string }[] | { error: string };
  if (!Array.isArray(results)) throw new Error(`Upstash error: ${results.error}`);
  const failed = results.find((item) => item.error);
  if (failed) throw new Error(`Upstash command error: ${failed.error}`);
  return results.map((item) => item.result);
}
