import type { DatabaseStatement } from "./database-adapter";
import type { ThreadRow, CommentRow } from "./thread-records";
import type * as schema from "./sqlite-schema";

type Row<K extends keyof typeof schema> = (typeof schema)[K]["$inferSelect"];
/** Stored records have the same public shape on both engines. */
export type DatabaseRow<K extends keyof typeof schema> = Row<K>;
/** Inputs share the existing storage shape on D1 and PostgreSQL. */
export type DatabaseInsert<K extends keyof typeof schema> =
  (typeof schema)[K]["$inferInsert"];
type Read<T> = DatabaseStatement<T>;
type Write = DatabaseStatement;

/** Domain operations implemented with native queries by each database adapter. */
/** Scope and pagination retain the existing thread ordering and cursor format. */
export type ThreadScope = { project: string; repo: string; branch: string };
export type ThreadPageOptions = {
  offset: number;
  id?: string;
  cursor?: [number, string];
};
export interface DatabaseOperations {
  scopeRevision(
    project: string,
    repo: string,
    branch: string,
  ): Read<{ version: number }>;
  threadPage(scope: ThreadScope, options: ThreadPageOptions): Read<ThreadRow>;
  threadComments(ids: string[]): Read<CommentRow>;
  threadReactions(ids: string[]): Read<Row<"reactions">>;
  projectCommentCount(project: string): Read<{ used: number }>;
  connectedProjects(user: string): Read<{ project: string }>;
  memberAccess(project: string, user: string): Read<{ user_id: string }>;
  incrementRateLimit(key: string, expires: number): Read<{ count: number }>;
  projectThread(id: string, project: string): Read<{ id: string }>;
  projectComment(id: string, project: string): Read<{ id: string }>;
  importUser(values: DatabaseInsert<"users">): Read<{ id: string }>;
  importThread(values: DatabaseInsert<"threads">): Read<{ id: string }>;
  importComment(values: DatabaseInsert<"comments">): Read<{ id: string }>;
  importReaction(
    values: DatabaseInsert<"reactions">,
  ): Read<{ comment_id: string }>;
  insertProjectMember(project: string, user: string): Write;
  exportRevision(project: string): Read<{ version: number }>;
  exportThreads(
    project: string,
    offset: number,
  ): Read<Omit<Row<"threads">, "project">>;
  exportComments(project: string, offset: number): Read<Row<"comments">>;
  exportReactions(project: string, offset: number): Read<Row<"reactions">>;
  exportUsers(
    project: string,
    offset: number,
  ): Read<Omit<Row<"users">, "email">>;
  clearResolvedThreads(project: string, ids?: string[]): Read<{ id: string }>;
  deleteProjectRecords(project: string): Write[];
  cleanupExpired(now: number): Write[];

  insertUser(values: DatabaseInsert<"users">, ignoreConflict?: boolean): Write;
  userById(id: string): Read<Row<"users">>;
  updateUser(id: string, values: Partial<DatabaseInsert<"users">>): Write;
  insertSession(values: DatabaseInsert<"sessions">): Write;
  sessionUser(hash: string, project: string, now: number): Read<Row<"users">>;
  deleteSession(hash: string): Write;
  deleteMemberSessions(project: string, user: string): Write;
  insertOAuthState(values: DatabaseInsert<"oauth_states">): Write;
  oauthVerifier(
    hash: string,
    provider: string,
    now: number,
  ): Read<Pick<Row<"oauth_states">, "verifier">>;
  consumeOAuthState(
    hash: string,
    provider: string,
    now: number,
  ): Read<Row<"oauth_states">>;
  insertSetupRequest(values: DatabaseInsert<"setup_requests">): Write;
  pendingSetup(
    id: string,
    now: number,
  ): Read<Pick<Row<"setup_requests">, "config">>;
  pollSetup(
    id: string,
    hash: string,
    now: number,
  ): Read<Pick<Row<"setup_requests">, "project" | "config">>;
  consumeSetup(id: string, now: number): Read<Row<"setup_requests">>;
  workspaceById(id: string): Read<Row<"workspaces">>;
  workspaceCount(user: string): Read<{ used: number }>;
  deleteWorkspace(id: string): Write;
  projectOwner(project: string): Read<Pick<Row<"project_owners">, "user_id">>;
  insertProjectOwner(project: string, user: string): Write;
  projectQuota(
    project: string,
  ): Read<Pick<Row<"project_quotas">, "comments" | "max_comments" | "bytes">>;
  projectAccess(project: string): Read<Pick<Row<"project_settings">, "access">>;
  setProjectAccess(project: string, access: string): Write;
  projectMembers(
    project: string,
  ): Read<Pick<Row<"users">, "id" | "name" | "email">>;
  projectInvites(
    project: string,
    now: number,
  ): Read<Pick<Row<"project_invites">, "email" | "expires_at">>;
  deleteProjectInvite(project: string, email: string): Write;
  deleteProjectMember(project: string, user: string): Write;
  projectSiteEdits(
    project: string,
  ): Read<Pick<Row<"project_sites">, "origin" | "removed">>;
  legacySiteEdits(project: string): Read<Pick<Row<"project_sites">, "origin">>;
  workspaceDomains(
    project: string,
  ): Read<Pick<Row<"workspace_domains">, "origin">>;
  deleteProjectSites(project: string): Write;
  insertProjectSite(values: DatabaseInsert<"project_sites">): Write;
  deleteWorkspaceDomains(project: string): Write;
  insertWorkspaceDomain(values: DatabaseInsert<"workspace_domains">): Write;
  insertThread(values: DatabaseInsert<"threads">): Write;
  scopedThread(
    id: string,
    project: string,
    repo: string,
    branch: string,
  ): Read<Row<"threads">>;
  updateThread(id: string, values: Partial<DatabaseInsert<"threads">>): Write;
  deleteProjectThreads(project: string): Write;
  insertComment(values: DatabaseInsert<"comments">): Write;
  threadComment(id: string, thread: string): Read<Row<"comments">>;
  firstCommentAuthor(thread: string): Read<Pick<Row<"comments">, "user_id">>;
  updateComment(id: string, body: string, now: number): Write;
  insertReaction(comment: string, user: string, emoji: string): Write;
  deleteReactions(comment: string, user?: string, emoji?: string): Write;
}
