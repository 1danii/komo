import { sql } from "drizzle-orm";
import type { Identity } from "../src/types";
import type { KomoBackendEnv } from "./database-adapter";
import { requireMember } from "./project-management";
import { githubAppRead, githubInstallationToken } from "./github-app-client";
import { HttpError } from "./validation";

type Destination = {
  installation_id: string;
  repository_id: string;
  repository_name: string;
};

/** A reservation older than this belongs to a request that never finished. */
const staleReservation = 60000;

async function destination(env: KomoBackendEnv, project: string) {
  return env.DB.raw<Destination>(
    sql`SELECT p.installation_id,p.repository_id,p.repository_name FROM project_github p
    JOIN project_owners o ON o.project=p.project AND o.user_id=p.owner_id
    WHERE p.project=${project} AND p.repository_id IS NOT NULL`,
  ).first();
}

/** Only explicit Google project members may use the shared bot; public visitors cannot. */
export async function githubConversionCapability(
  env: KomoBackendEnv,
  project: string,
  user: Identity,
) {
  if (
    !user.verified ||
    !user.id.startsWith("google:") ||
    !(await env.DB.operations.memberAccess(project, user.id).first())
  )
    return { repository: null };
  const target = await destination(env, project);
  return { repository: target?.repository_name ?? null };
}

/** Snapshot discussion as Markdown, preserving multiline comments and chronological replies. */
export function githubIssueBody(
  comments: { name: string; body: string }[],
  link?: string,
) {
  const name = (text: string) =>
    text.replace(/[\\`*_{}[\]<>#|]/g, "\\$&").replace(/[\r\n]/g, " ");
  const first = comments[0];
  if (!first)
    throw new HttpError(409, "This thread has no comments to convert.");
  const body = [
    `Issue originates from comment by **${name(first.name)}**:`,
    "",
    first.body,
    ...(comments.length > 1
      ? [
          "",
          "## Replies",
          "",
          ...comments
            .slice(1)
            .flatMap((item) => [`**${name(item.name)}:** ${item.body}`, ""]),
        ]
      : []),
    ...(link ? ["", `[View original thread](${link})`] : []),
  ].join("\n");
  if (body.length > 65000)
    throw new HttpError(
      400,
      "This discussion is too long for one GitHub issue.",
    );
  return body;
}

/** Create an issue as the App bot, link it to the thread, and resolve the thread. */
export async function convertThreadToGithubIssue(
  env: KomoBackendEnv,
  scope: { project: string; repo: string; branch: string },
  user: Identity,
  threadId: string,
  title: string,
  origin: string,
) {
  await requireMember(env, scope.project, user);
  const thread = await env.DB.raw<{ page: string; resolved: number }>(
    sql`SELECT page,resolved FROM threads WHERE id=${threadId} AND project=${scope.project} AND repo=${scope.repo} AND branch=${scope.branch}`,
  ).first();
  if (!thread) throw new HttpError(404, "Thread not found on this branch.");
  const linked = await env.DB.raw<{
    issue_url: string;
    issue_number: number;
    repository_name: string;
  }>(
    sql`SELECT issue_url,issue_number,repository_name FROM thread_github_issues WHERE thread_id=${threadId} AND issue_url IS NOT NULL`,
  ).first();
  if (linked)
    return {
      url: linked.issue_url,
      number: linked.issue_number,
      repository: linked.repository_name,
    };
  if (thread.resolved)
    throw new HttpError(409, "Reopen this thread before converting it.");
  const target = await destination(env, scope.project);
  if (!target)
    throw new HttpError(
      409,
      "Choose a GitHub repository in Project settings first.",
    );
  const token = await githubInstallationToken(
    env,
    target.installation_id,
    target.repository_id,
  );
  const repository = await githubAppRead<{
    id: number;
    full_name: string;
    archived: boolean;
    has_issues: boolean;
  }>(token, `/repositories/${encodeURIComponent(target.repository_id)}`);
  if (
    String(repository.id) !== target.repository_id ||
    repository.archived ||
    !repository.has_issues
  )
    throw new HttpError(409, "This repository cannot accept issues.");
  // The reservation only stops double submission; every failure releases it.
  const now = Date.now();
  const [, reserved] = await env.DB.batch([
    env.DB.raw(
      sql`DELETE FROM thread_github_issues WHERE thread_id=${threadId} AND issue_url IS NULL AND created_at<${now - staleReservation}`,
    ),
    env.DB.raw(
      sql`INSERT INTO thread_github_issues(thread_id,project,repository_name,created_by,created_at)
      VALUES(${threadId},${scope.project},${repository.full_name},${user.id},${now})
      ON CONFLICT(thread_id) DO NOTHING RETURNING thread_id`,
    ),
  ]);
  if (!reserved.results.length)
    throw new HttpError(409, "Issue creation is already in progress.");
  let issue: { number: number; url: string };
  try {
    const comments = await env.DB.operations
      .threadComments([threadId])
      .execute();
    const page = new URL(thread.page, origin);
    page.searchParams.set("comment", threadId);
    const body = githubIssueBody(
      comments.results,
      /^https?:$/.test(page.protocol) ? page.href : undefined,
    );
    const response = await fetch(
      `https://api.github.com/repos/${repository.full_name.split("/").map(encodeURIComponent).join("/")}/issues`,
      {
        method: "POST",
        redirect: "manual",
        signal: AbortSignal.timeout(15000),
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "komo",
        },
        body: JSON.stringify({ title, body }),
      },
    ).catch(() => {
      throw new HttpError(502, "GitHub did not respond. Try again.");
    });
    if (!response.ok)
      throw new HttpError(
        409,
        "GitHub could not create the issue. Check repository access and try again.",
      );
    const result = await response
      .json<{ number?: number; html_url?: string; pull_request?: unknown }>()
      .catch(() => ({}) as { number?: number; html_url?: string });
    if (
      !Number.isSafeInteger(result.number) ||
      !/^https:\/\/github\.com\/[^/]+\/[^/]+\/issues\/[1-9][0-9]*$/.test(
        result.html_url ?? "",
      )
    )
      throw new HttpError(502, "Invalid GitHub issue response.");
    issue = { number: result.number!, url: result.html_url! };
  } catch (error) {
    await env.DB.raw(
      sql`DELETE FROM thread_github_issues WHERE thread_id=${threadId} AND issue_url IS NULL AND created_at=${now}`,
    ).execute();
    throw error;
  }
  await env.DB.batch([
    env.DB.raw(
      sql`UPDATE thread_github_issues SET issue_number=${issue.number},issue_url=${issue.url} WHERE thread_id=${threadId}`,
    ),
    env.DB.raw(
      sql`UPDATE threads SET resolved=1,resolved_by=${user.id},updated_at=${Date.now()} WHERE id=${threadId}`,
    ),
  ]);
  return { ...issue, repository: repository.full_name };
}
