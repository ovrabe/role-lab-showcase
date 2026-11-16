/**
 * One place for everything people send the author: tester reports and feedback become issues
 * in the project's private GitHub repository (docs/PRODUCTION.md). The author and Claude read,
 * sort and close them there like any other backlog item.
 *
 * The token lives only in the server's environment (GITHUB_ISSUES_TOKEN), never in the page.
 * It should be a fine-grained token that can only create issues in that one repository.
 */
export type Issue = { title: string; body: string; labels: string[] };
export type IssueTracker = { create(issue: Issue): Promise<void> };

// GitHub refuses longer titles; bodies are capped so one message cannot flood the backlog.
const maxTitleLength = 120;
const maxBodyLength = 20_000;
const requestTimeoutMs = 10_000;

export function githubIssueTracker(token: string, repository: string): IssueTracker {
  return {
    async create(issue) {
      const response = await fetch(`https://api.github.com/repos/${repository}/issues`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          accept: "application/vnd.github+json",
          "x-github-api-version": "2022-11-28",
          "content-type": "application/json",
          // GitHub requires a User-Agent; a generic one, nothing about the person.
          "user-agent": "role-lab",
        },
        body: JSON.stringify({
          title: issue.title.slice(0, maxTitleLength),
          body: issue.body.slice(0, maxBodyLength),
          labels: issue.labels,
        }),
        signal: AbortSignal.timeout(requestTimeoutMs),
      });
      // Only the status goes into the error: GitHub's reply could echo request details.
      if (!response.ok) throw new Error(`GitHub issue could not be created (status ${response.status}).`);
    },
  };
}

/** For local development and tests: keeps the issues in memory. */
export function memoryIssueTracker(): IssueTracker & { issues: Issue[] } {
  const issues: Issue[] = [];
  return {
    issues,
    async create(issue) {
      issues.unshift(issue);
    },
  };
}
