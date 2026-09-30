import {
  and,
  count,
  eq,
  getColumns,
  gt,
  isNull,
  inArray,
  notInArray,
  or,
  lt,
  like,
  sql,
  type SQL,
} from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { drizzle } from "drizzle-orm/d1";
import {
  databaseErrorCause,
  type BatchResults,
  type DatabaseResult,
  type DatabaseStatement,
  type KomoBackendEnv,
  type KomoDatabase,
} from "./database-adapter";
import type {
  DatabaseInsert,
  ThreadScope,
  ThreadPageOptions,
} from "./database-operations";
import * as t from "./sqlite-schema";

const adapters = new WeakMap<D1Database, KomoDatabase>();

/** Native Drizzle queries use D1's atomic batch execution and result decoding. */
export function createD1Adapter(binding: D1Database): KomoDatabase {
  const existing = adapters.get(binding);
  if (existing) return existing;
  const db = drizzle(binding);
  // A per-adapter class keeps foreign operations out of an atomic batch.
  class D1Statement<Row> implements DatabaseStatement<Row> {
    constructor(
      readonly query: BatchItem<"sqlite">,
      readonly decode: (value: unknown) => DatabaseResult<Row>,
    ) {}
    async execute(): Promise<DatabaseResult<Row>> {
      try {
        const [result] = await db.batch([this.query]);
        return this.decode(result);
      } catch (error) {
        throw databaseErrorCause(error);
      }
    }
    async first() {
      return (await this.execute()).results[0] ?? null;
    }
  }
  const read = <Row>(
    query: BatchItem<"sqlite"> & { all(): Promise<Row[]> },
    mutation = false,
  ) =>
    new D1Statement(query, (value) => {
      const results = value as Row[];
      return { results, meta: { changes: mutation ? results.length : 0 } };
    });
  const raw = <Row = Record<string, unknown>>(
    statement: SQL,
  ): DatabaseStatement<Row> =>
    new D1Statement(db.run(statement), (value) => {
      const result = value as D1Result<Row>;
      return {
        results: result.results,
        meta: { changes: result.meta.changes },
      };
    });
  const write = (query: BatchItem<"sqlite"> & { run(): Promise<D1Result> }) =>
    new D1Statement(query, (value) => {
      const result = value as D1Result<Record<string, unknown>>;
      return {
        results: result.results,
        meta: { changes: result.meta.changes },
      };
    });
  const adapter: KomoDatabase = {
    dialect: "sqlite",
    operations: {
      scopeRevision: (project: string, repo: string, branch: string) =>
        read(
          db
            .select({ version: t.scope_revisions.version })
            .from(t.scope_revisions)
            .where(
              and(
                eq(t.scope_revisions.project, project),
                eq(t.scope_revisions.repo, repo),
                eq(t.scope_revisions.branch, branch),
              ),
            ),
        ),
      threadPage: (scope: ThreadScope, options: ThreadPageOptions) =>
        read(
          db
            .select({
              ...getColumns(t.threads),
              resolver_name: t.users.name,
              resolver_verified: t.users.verified,
            })
            .from(t.threads)
            .leftJoin(t.users, eq(t.users.id, t.threads.resolved_by))
            .where(
              and(
                eq(t.threads.project, scope.project),
                eq(t.threads.repo, scope.repo),
                eq(t.threads.branch, scope.branch),
                options.id ? eq(t.threads.id, options.id) : undefined,
                options.cursor
                  ? or(
                      gt(t.threads.created_at, options.cursor[0]),
                      and(
                        eq(t.threads.created_at, options.cursor[0]),
                        gt(t.threads.id, options.cursor[1]),
                      ),
                    )
                  : undefined,
              ),
            )
            .orderBy(t.threads.created_at, t.threads.id)
            .limit(50)
            .offset(options.cursor ? 0 : options.offset),
        ),
      threadComments: (ids: string[]) =>
        read(
          db
            .select({
              id: t.comments.id,
              thread_id: t.comments.thread_id,
              user_id: t.comments.user_id,
              body: t.comments.body,
              created_at: t.comments.created_at,
              edited_at: t.comments.edited_at,
              name: t.users.name,
              verified: t.users.verified,
              avatar_url: t.users.avatar_url,
              accent_color: t.users.accent_color,
            })
            .from(t.comments)
            .innerJoin(t.users, eq(t.users.id, t.comments.user_id))
            .where(inArray(t.comments.thread_id, ids))
            .orderBy(t.comments.created_at, t.comments.id),
        ),
      threadReactions: (ids: string[]) =>
        read(
          db
            .select(getColumns(t.reactions))
            .from(t.reactions)
            .innerJoin(t.comments, eq(t.comments.id, t.reactions.comment_id))
            .where(inArray(t.comments.thread_id, ids)),
        ),
      projectCommentCount: (project: string) =>
        read(
          db
            .select({ used: count() })
            .from(t.comments)
            .innerJoin(t.threads, eq(t.threads.id, t.comments.thread_id))
            .where(eq(t.threads.project, project)),
        ),
      connectedProjects: (user: string) =>
        read(
          db
            .select({ project: t.project_members.project })
            .from(t.project_members)
            .where(eq(t.project_members.user_id, user))
            .union(
              db
                .select({ project: t.project_owners.project })
                .from(t.project_owners)
                .where(eq(t.project_owners.user_id, user)),
            ),
        ),
      memberAccess: (project: string, user: string) =>
        read(
          db
            .select({ user_id: t.project_owners.user_id })
            .from(t.project_owners)
            .where(
              and(
                eq(t.project_owners.project, project),
                eq(t.project_owners.user_id, user),
              ),
            )
            .union(
              db
                .select({ user_id: t.project_access.user_id })
                .from(t.project_access)
                .where(
                  and(
                    eq(t.project_access.project, project),
                    eq(t.project_access.user_id, user),
                  ),
                ),
            ),
        ),
      incrementRateLimit: (key: string, expires: number) =>
        read(
          db
            .insert(t.rate_limits)
            .values({ key, count: 1, expires_at: expires })
            .onConflictDoUpdate({
              target: t.rate_limits.key,
              set: { count: sql`${t.rate_limits.count}+1` },
            })
            .returning({ count: t.rate_limits.count }),
          true,
        ),
      projectThread: (id: string, project: string) =>
        read(
          db
            .select({ id: t.threads.id })
            .from(t.threads)
            .where(and(eq(t.threads.id, id), eq(t.threads.project, project))),
        ),
      projectComment: (id: string, project: string) =>
        read(
          db
            .select({ id: t.comments.id })
            .from(t.comments)
            .innerJoin(t.threads, eq(t.threads.id, t.comments.thread_id))
            .where(and(eq(t.comments.id, id), eq(t.threads.project, project))),
        ),
      importUser: (values: DatabaseInsert<"users">) =>
        read(
          db
            .insert(t.users)
            .values(values)
            .onConflictDoNothing()
            .returning({ id: t.users.id }),
          true,
        ),
      importThread: (values: DatabaseInsert<"threads">) =>
        read(
          db
            .insert(t.threads)
            .values(values)
            .onConflictDoNothing()
            .returning({ id: t.threads.id }),
          true,
        ),
      importComment: (values: DatabaseInsert<"comments">) =>
        read(
          db
            .insert(t.comments)
            .values(values)
            .onConflictDoNothing()
            .returning({ id: t.comments.id }),
          true,
        ),
      importReaction: (values: DatabaseInsert<"reactions">) =>
        read(
          db
            .insert(t.reactions)
            .values(values)
            .onConflictDoNothing()
            .returning({ comment_id: t.reactions.comment_id }),
          true,
        ),
      insertProjectMember: (project: string, user: string) =>
        write(
          db
            .insert(t.project_members)
            .values({ project, user_id: user })
            .onConflictDoNothing(),
        ),
      exportRevision: (project: string) =>
        read(
          db
            .select({ version: t.export_revisions.version })
            .from(t.export_revisions)
            .where(eq(t.export_revisions.project, project)),
        ),
      exportThreads: (project: string, offset: number) =>
        read(
          db
            .select({
              id: t.threads.id,
              repo: t.threads.repo,
              branch: t.threads.branch,
              page: t.threads.page,
              anchor: t.threads.anchor,
              resolved: t.threads.resolved,
              resolved_by: t.threads.resolved_by,
              created_at: t.threads.created_at,
              updated_at: t.threads.updated_at,
            })
            .from(t.threads)
            .where(eq(t.threads.project, project))
            .orderBy(t.threads.id)
            .limit(200)
            .offset(offset),
        ),
      exportComments: (project: string, offset: number) =>
        read(
          db
            .select({
              id: t.comments.id,
              thread_id: t.comments.thread_id,
              user_id: t.comments.user_id,
              body: t.comments.body,
              created_at: t.comments.created_at,
              edited_at: t.comments.edited_at,
            })
            .from(t.comments)
            .innerJoin(t.threads, eq(t.threads.id, t.comments.thread_id))
            .where(eq(t.threads.project, project))
            .orderBy(t.comments.id)
            .limit(200)
            .offset(offset),
        ),
      exportReactions: (project: string, offset: number) =>
        read(
          db
            .select(getColumns(t.reactions))
            .from(t.reactions)
            .innerJoin(t.comments, eq(t.comments.id, t.reactions.comment_id))
            .innerJoin(t.threads, eq(t.threads.id, t.comments.thread_id))
            .where(eq(t.threads.project, project))
            .orderBy(
              t.reactions.comment_id,
              t.reactions.user_id,
              t.reactions.emoji,
            )
            .limit(200)
            .offset(offset),
        ),
      exportUsers: (project: string, offset: number) =>
        read(
          db
            .selectDistinct({
              id: t.users.id,
              name: t.users.name,
              verified: t.users.verified,
              avatar_url: t.users.avatar_url,
              accent_color: t.users.accent_color,
            })
            .from(t.users)
            .where(
              or(
                inArray(
                  t.users.id,
                  db
                    .select({ user: t.comments.user_id })
                    .from(t.comments)
                    .innerJoin(
                      t.threads,
                      eq(t.threads.id, t.comments.thread_id),
                    )
                    .where(eq(t.threads.project, project)),
                ),
                inArray(
                  t.users.id,
                  db
                    .select({ user: t.threads.resolved_by })
                    .from(t.threads)
                    .where(eq(t.threads.project, project)),
                ),
                inArray(
                  t.users.id,
                  db
                    .select({ user: t.reactions.user_id })
                    .from(t.reactions)
                    .innerJoin(
                      t.comments,
                      eq(t.comments.id, t.reactions.comment_id),
                    )
                    .innerJoin(
                      t.threads,
                      eq(t.threads.id, t.comments.thread_id),
                    )
                    .where(eq(t.threads.project, project)),
                ),
              ),
            )
            .orderBy(t.users.id)
            .limit(200)
            .offset(offset),
        ),
      clearResolvedThreads: (project: string, ids?: string[]) =>
        read(
          db
            .delete(t.threads)
            .where(
              and(
                eq(t.threads.project, project),
                eq(t.threads.resolved, 1),
                // Bind the ID list once to stay within D1's parameter limit.
                ids
                  ? inArray(
                      t.threads.id,
                      db
                        .select({ value: sql<string>`value` })
                        .from(sql`json_each(${JSON.stringify(ids)})`),
                    )
                  : undefined,
              ),
            )
            .returning({ id: t.threads.id }),
          true,
        ),
      deleteProjectRecords: (project: string) => [
        write(db.delete(t.sessions).where(eq(t.sessions.project, project))),
        write(
          db
            .delete(t.project_members)
            .where(eq(t.project_members.project, project)),
        ),
        write(
          db
            .delete(t.project_access)
            .where(eq(t.project_access.project, project)),
        ),
        write(
          db
            .delete(t.project_invites)
            .where(eq(t.project_invites.project, project)),
        ),
        write(
          db
            .delete(t.project_settings)
            .where(eq(t.project_settings.project, project)),
        ),
        write(
          db
            .delete(t.project_owners)
            .where(eq(t.project_owners.project, project)),
        ),
        write(
          db
            .delete(t.project_quotas)
            .where(eq(t.project_quotas.project, project)),
        ),
        write(
          db
            .delete(t.workspace_domains)
            .where(eq(t.workspace_domains.project, project)),
        ),
        write(
          db
            .delete(t.scope_revisions)
            .where(eq(t.scope_revisions.project, project)),
        ),
        write(
          db
            .delete(t.export_revisions)
            .where(eq(t.export_revisions.project, project)),
        ),
        write(
          db.delete(t.oauth_states).where(eq(t.oauth_states.project, project)),
        ),
        write(
          db
            .delete(t.setup_requests)
            .where(eq(t.setup_requests.project, project)),
        ),
      ],
      cleanupExpired: (now: number) => [
        write(
          db.delete(t.rate_limits).where(lt(t.rate_limits.expires_at, now)),
        ),
        write(db.delete(t.sessions).where(lt(t.sessions.expires_at, now))),
        write(
          db
            .delete(t.project_invites)
            .where(lt(t.project_invites.expires_at, now)),
        ),
        write(
          db.delete(t.oauth_states).where(lt(t.oauth_states.expires_at, now)),
        ),
        write(
          db
            .delete(t.setup_requests)
            .where(lt(t.setup_requests.expires_at, now)),
        ),
        write(
          db
            .delete(t.users)
            .where(
              and(
                like(t.users.id, "guest:%"),
                notInArray(
                  t.users.id,
                  db.select({ id: t.sessions.user_id }).from(t.sessions),
                ),
                notInArray(
                  t.users.id,
                  db.select({ id: t.comments.user_id }).from(t.comments),
                ),
                notInArray(
                  t.users.id,
                  db
                    .select({ id: t.project_members.user_id })
                    .from(t.project_members),
                ),
              ),
            ),
        ),
      ],

      insertUser: (values: DatabaseInsert<"users">, ignoreConflict = false) => {
        return write(
          ignoreConflict
            ? db
                .insert(t.users)
                .values(values)
                .onConflictDoNothing({ target: t.users.id })
            : db.insert(t.users).values(values),
        );
      },
      userById: (id: string) =>
        read(db.select().from(t.users).where(eq(t.users.id, id))),
      updateUser: (id: string, values: Partial<DatabaseInsert<"users">>) =>
        write(db.update(t.users).set(values).where(eq(t.users.id, id))),
      insertSession: (values: DatabaseInsert<"sessions">) =>
        write(db.insert(t.sessions).values(values)),
      sessionUser: (hash: string, project: string, now: number) =>
        read(
          db
            .select(getColumns(t.users))
            .from(t.sessions)
            .innerJoin(t.users, eq(t.users.id, t.sessions.user_id))
            .where(
              and(
                eq(t.sessions.token_hash, hash),
                eq(t.sessions.project, project),
                gt(t.sessions.expires_at, now),
              ),
            ),
        ),
      deleteSession: (hash: string) =>
        write(db.delete(t.sessions).where(eq(t.sessions.token_hash, hash))),
      deleteMemberSessions: (project: string, user: string) =>
        write(
          db
            .delete(t.sessions)
            .where(
              and(
                eq(t.sessions.project, project),
                eq(t.sessions.user_id, user),
              ),
            ),
        ),
      insertOAuthState: (values: DatabaseInsert<"oauth_states">) =>
        write(db.insert(t.oauth_states).values(values)),
      oauthVerifier: (hash: string, provider: string, now: number) =>
        read(
          db
            .select({ verifier: t.oauth_states.verifier })
            .from(t.oauth_states)
            .where(
              and(
                eq(t.oauth_states.state_hash, hash),
                eq(t.oauth_states.provider, provider),
                gt(t.oauth_states.expires_at, now),
              ),
            ),
        ),
      consumeOAuthState: (hash: string, provider: string, now: number) =>
        read(
          db
            .delete(t.oauth_states)
            .where(
              and(
                eq(t.oauth_states.state_hash, hash),
                eq(t.oauth_states.provider, provider),
                gt(t.oauth_states.expires_at, now),
              ),
            )
            .returning(),
          true,
        ),
      insertSetupRequest: (values: DatabaseInsert<"setup_requests">) =>
        write(db.insert(t.setup_requests).values(values)),
      pendingSetup: (id: string, now: number) =>
        read(
          db
            .select({ config: t.setup_requests.config })
            .from(t.setup_requests)
            .where(
              and(
                eq(t.setup_requests.id, id),
                isNull(t.setup_requests.project),
                gt(t.setup_requests.expires_at, now),
              ),
            ),
        ),
      pollSetup: (id: string, hash: string, now: number) =>
        read(
          db
            .select({
              project: t.setup_requests.project,
              config: t.setup_requests.config,
            })
            .from(t.setup_requests)
            .where(
              and(
                eq(t.setup_requests.id, id),
                eq(t.setup_requests.poll_hash, hash),
                gt(t.setup_requests.expires_at, now),
              ),
            ),
        ),
      consumeSetup: (id: string, now: number) =>
        read(
          db
            .delete(t.setup_requests)
            .where(
              and(
                eq(t.setup_requests.id, id),
                isNull(t.setup_requests.project),
                gt(t.setup_requests.expires_at, now),
              ),
            )
            .returning(),
          true,
        ),
      workspaceById: (id: string) =>
        read(db.select().from(t.workspaces).where(eq(t.workspaces.id, id))),
      workspaceCount: (user: string) =>
        read(
          db
            .select({ used: count() })
            .from(t.workspaces)
            .where(eq(t.workspaces.owner_id, user)),
        ),
      deleteWorkspace: (id: string) =>
        write(db.delete(t.workspaces).where(eq(t.workspaces.id, id))),
      projectOwner: (project: string) =>
        read(
          db
            .select({ user_id: t.project_owners.user_id })
            .from(t.project_owners)
            .where(eq(t.project_owners.project, project)),
        ),
      insertProjectOwner: (project: string, user: string) =>
        write(
          db
            .insert(t.project_owners)
            .values({ project, user_id: user })
            .onConflictDoNothing(),
        ),
      projectQuota: (project: string) =>
        read(
          db
            .select({
              comments: t.project_quotas.comments,
              max_comments: t.project_quotas.max_comments,
              bytes: t.project_quotas.bytes,
            })
            .from(t.project_quotas)
            .where(eq(t.project_quotas.project, project)),
        ),
      projectAccess: (project: string) =>
        read(
          db
            .select({ access: t.project_settings.access })
            .from(t.project_settings)
            .where(eq(t.project_settings.project, project)),
        ),
      setProjectAccess: (project: string, access: string) =>
        write(
          db
            .insert(t.project_settings)
            .values({ project, access })
            .onConflictDoUpdate({
              target: t.project_settings.project,
              set: { access },
            }),
        ),
      projectMembers: (project: string) =>
        read(
          db
            .select({
              id: t.users.id,
              name: t.users.name,
              email: t.users.email,
            })
            .from(t.project_access)
            .innerJoin(t.users, eq(t.users.id, t.project_access.user_id))
            .where(eq(t.project_access.project, project))
            .orderBy(t.users.name),
        ),
      projectInvites: (project: string, now: number) =>
        read(
          db
            .select({
              email: t.project_invites.email,
              expires_at: t.project_invites.expires_at,
            })
            .from(t.project_invites)
            .where(
              and(
                eq(t.project_invites.project, project),
                gt(t.project_invites.expires_at, now),
              ),
            )
            .orderBy(t.project_invites.email),
        ),
      deleteProjectInvite: (project: string, email: string) =>
        write(
          db
            .delete(t.project_invites)
            .where(
              and(
                eq(t.project_invites.project, project),
                eq(t.project_invites.email, email),
              ),
            ),
        ),
      deleteProjectMember: (project: string, user: string) =>
        write(
          db
            .delete(t.project_access)
            .where(
              and(
                eq(t.project_access.project, project),
                eq(t.project_access.user_id, user),
              ),
            ),
        ),
      projectSiteEdits: (project: string) =>
        read(
          db
            .select({
              origin: t.project_sites.origin,
              removed: t.project_sites.removed,
            })
            .from(t.project_sites)
            .where(eq(t.project_sites.project, project)),
        ),
      legacySiteEdits: (project: string) =>
        read(
          db
            .select({ origin: t.project_sites.origin })
            .from(t.project_sites)
            .where(eq(t.project_sites.project, project)),
        ),
      workspaceDomains: (project: string) =>
        read(
          db
            .select({ origin: t.workspace_domains.origin })
            .from(t.workspace_domains)
            .where(eq(t.workspace_domains.project, project))
            .orderBy(t.workspace_domains.origin),
        ),
      deleteProjectSites: (project: string) =>
        write(
          db
            .delete(t.project_sites)
            .where(eq(t.project_sites.project, project)),
        ),
      insertProjectSite: (values: DatabaseInsert<"project_sites">) =>
        write(db.insert(t.project_sites).values(values)),
      deleteWorkspaceDomains: (project: string) =>
        write(
          db
            .delete(t.workspace_domains)
            .where(eq(t.workspace_domains.project, project)),
        ),
      insertWorkspaceDomain: (values: DatabaseInsert<"workspace_domains">) =>
        write(db.insert(t.workspace_domains).values(values)),
      insertThread: (values: DatabaseInsert<"threads">) =>
        write(db.insert(t.threads).values(values)),
      scopedThread: (
        id: string,
        project: string,
        repo: string,
        branch: string,
      ) =>
        read(
          db
            .select()
            .from(t.threads)
            .where(
              and(
                eq(t.threads.id, id),
                eq(t.threads.project, project),
                eq(t.threads.repo, repo),
                eq(t.threads.branch, branch),
              ),
            ),
        ),
      updateThread: (id: string, values: Partial<DatabaseInsert<"threads">>) =>
        write(db.update(t.threads).set(values).where(eq(t.threads.id, id))),
      deleteProjectThreads: (project: string) =>
        write(db.delete(t.threads).where(eq(t.threads.project, project))),
      insertComment: (values: DatabaseInsert<"comments">) =>
        write(db.insert(t.comments).values(values)),
      threadComment: (id: string, thread: string) =>
        read(
          db
            .select({
              id: t.comments.id,
              thread_id: t.comments.thread_id,
              user_id: t.comments.user_id,
              body: t.comments.body,
              created_at: t.comments.created_at,
              edited_at: t.comments.edited_at,
            })
            .from(t.comments)
            .where(
              and(eq(t.comments.id, id), eq(t.comments.thread_id, thread)),
            ),
        ),
      firstCommentAuthor: (thread: string) =>
        read(
          db
            .select({ user_id: t.comments.user_id })
            .from(t.comments)
            .where(eq(t.comments.thread_id, thread))
            .orderBy(t.comments.created_at, t.comments.id)
            .limit(1),
        ),
      updateComment: (id: string, body: string, now: number) =>
        write(
          db
            .update(t.comments)
            .set({ body, edited_at: now })
            .where(eq(t.comments.id, id)),
        ),
      insertReaction: (comment: string, user: string, emoji: string) =>
        write(
          db
            .insert(t.reactions)
            .values({ comment_id: comment, user_id: user, emoji })
            .onConflictDoNothing(),
        ),
      deleteReactions: (comment: string, user?: string, emoji?: string) =>
        write(
          db
            .delete(t.reactions)
            .where(
              and(
                eq(t.reactions.comment_id, comment),
                user === undefined ? undefined : eq(t.reactions.user_id, user),
                emoji === undefined ? undefined : eq(t.reactions.emoji, emoji),
              ),
            ),
        ),
    },
    commentSequence: sql`c.rowid`,
    raw,
    async batch<const T extends readonly DatabaseStatement<unknown>[]>(
      statements: T,
    ): Promise<BatchResults<T>> {
      if (!statements.length) return [] as BatchResults<T>;
      const commands = statements.map((statement) => {
        if (!(statement instanceof D1Statement))
          throw Error(
            "Database batch contains an operation from another adapter.",
          );
        return statement;
      });
      try {
        const [first, ...rest] = commands.map((statement) => statement.query);
        const results = await db.batch([first, ...rest]);
        return results.map((result, index) =>
          commands[index].decode(result),
        ) as BatchResults<T>;
      } catch (error) {
        throw databaseErrorCause(error);
      }
    },
  };
  adapters.set(binding, adapter);
  return adapter;
}

/** Preserve the Worker binding API while accepting the internal Node adapter. */
export function backendEnvironment(env: Env | KomoBackendEnv): KomoBackendEnv {
  return { ...env, DB: "dialect" in env.DB ? env.DB : createD1Adapter(env.DB) };
}
