import { sql } from "drizzle-orm";
import type { Identity } from "../src/types";
import type {
  DatabaseStatement,
  KomoBackendEnv,
  KomoDatabase,
} from "./database-adapter";
import { editedOrigins, siteEdits } from "./project-sites";
import { originAllowed, string, HttpError } from "./validation";
export type Project = {
  repo: string;
  origins: string[];
  allowGuests?: boolean;
  allowGuestResolve?: boolean;
  requireOwner?: boolean;
  bootstrapHash?: string;
  suspended?: boolean;
  writesPerDay?: number;
  retainedCommentsPerUser?: number;
};

export function retainReviewerComments(
  db: KomoDatabase,
  project: string,
  user: string,
  limit: number | undefined,
): DatabaseStatement[] {
  if (!limit || !Number.isInteger(limit) || limit < 1) return [];
  // Remove only this reviewer's threads that would become empty. Do this before
  // pruning their comments so candidate IDs remain available; delete triggers
  // preserve quota/revision accounting. Newest retained comments are untouched.
  return [
    db.raw(sql`WITH kept AS MATERIALIZED (
      SELECT c.id FROM comments c JOIN threads t ON t.id=c.thread_id
      WHERE c.user_id=${user} AND t.project=${project} ORDER BY c.created_at DESC,${db.commentSequence} DESC LIMIT ${limit}
    ) DELETE FROM threads WHERE project=${project}
      AND id IN (SELECT thread_id FROM comments WHERE user_id=${user})
      AND NOT EXISTS (SELECT 1 FROM comments c WHERE c.thread_id=threads.id
        AND (c.user_id<>${user} OR c.id IN (SELECT id FROM kept)))`),
    db.raw(sql`DELETE FROM comments WHERE user_id=${user}
      AND thread_id IN (SELECT id FROM threads WHERE project=${project})
      AND id NOT IN (SELECT c.id FROM comments c JOIN threads t ON t.id=c.thread_id
        WHERE c.user_id=${user} AND t.project=${project} ORDER BY c.created_at DESC,${db.commentSequence} DESC LIMIT ${limit})`),
  ];
}
export async function projectConfig(
  env: KomoBackendEnv,
  project: string,
): Promise<Project | undefined> {
  const staticConfig = (JSON.parse(env.PROJECTS) as Record<string, Project>)[
    project
  ];
  if (staticConfig)
    return {
      ...staticConfig,
      origins: editedOrigins(
        staticConfig.origins,
        await siteEdits(env, project),
      ),
    };
  const row = await env.DB.operations.workspaceById(project).first();
  if (!row) return undefined;
  const verified = await env.DB.operations.workspaceDomains(project).execute();
  // Localhost is allowed for every project at the router.
  return {
    repo: row.repo,
    origins: verified.results.map((item) => item.origin),
    requireOwner: true,
    suspended: !!row.suspended,
    writesPerDay: 500,
  };
}
export async function googleOwner(
  env: KomoBackendEnv,
  project: string,
  user: Identity,
) {
  if (!(user.verified && user.id.startsWith("google:")))
    throw new HttpError(403, "Sign in with Google to manage this workspace.");
  const owner = await env.DB.operations.projectOwner(project).first();
  if (owner?.user_id !== user.id)
    throw new HttpError(403, "Only the workspace owner can do that.");
}
export function workspaceConfig(config: Record<string, unknown>): {
  repo: string;
  origins: string[];
} {
  const repo = string(config.repo, 200, "repository");
  const origins = config.origins;
  if (
    !(
      Array.isArray(origins) &&
      origins.length > 0 &&
      origins.length <= 10 &&
      origins.every(
        (origin) =>
          typeof origin === "string" &&
          origin.length <= 300 &&
          originAllowed(origin, [origin]) &&
          (origin.startsWith("https://") ||
            /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)),
      )
    )
  )
    throw new HttpError(400, "Use exact HTTPS site origins or localhost.");
  return { repo, origins };
}

export async function provision(
  env: KomoBackendEnv,
  user: Identity,
  config: Record<string, unknown>,
) {
  if (!(user.verified && user.id.startsWith("google:")))
    throw new HttpError(
      403,
      "A Google account is required to create a workspace.",
    );
  const { repo, origins } = workspaceConfig(config);
  const id = `komo_${crypto.randomUUID().replaceAll("-", "")}`;
  const results = await env.DB.batch([
    env.DB.raw(
      sql`INSERT INTO workspaces(id,owner_id,repo,origins,created_at) SELECT ${id},${user.id},${repo},${JSON.stringify(origins)},${Date.now()} WHERE (SELECT COUNT(*) FROM workspaces WHERE owner_id=${user.id})<3`,
    ),
    env.DB.raw(
      sql`INSERT INTO project_owners(project,user_id) SELECT id,owner_id FROM workspaces WHERE id=${id}`,
    ),
    env.DB.raw(
      sql`INSERT INTO project_quotas(project,max_comments,max_bytes) SELECT id,250,10485760 FROM workspaces WHERE id=${id}`,
    ),
  ]);
  if (!results[0].meta.changes)
    throw new HttpError(409, "Your account has reached three hosted projects.");
  return { project: id, repo };
}

// Cron owns hosted cleanup. Self-hosted deployments without cron get one attempt
// per database/isolate/hour; concurrent requests share the same deadline.
const nextCleanup = new WeakMap<KomoDatabase, number>();
export async function maintain(db: KomoDatabase, scheduled = false) {
  const now = Date.now();
  if (!scheduled && now < (nextCleanup.get(db) ?? 0)) return;
  nextCleanup.set(db, now + 3600000);
  try {
    await db.batch(db.operations.cleanupExpired(now));
  } catch (error) {
    // Retry transient failures after a minute, not on every incoming request.
    nextCleanup.set(db, now + 60000);
    throw error;
  }
}
