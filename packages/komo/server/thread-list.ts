import type { Comment, Identity, Thread } from "../src/types.js";
import type { KomoDatabase } from "./database-adapter";
import type { CommentRow } from "./thread-records";
import { HttpError, pagePath, string } from "./validation";
/** List one scoped thread page, retaining revision and compact-author responses. */
export async function listThreadPage(
  db: KomoDatabase,
  scope: { project: string; repo: string; branch: string },
  url: URL,
) {
  const { project, repo, branch } = scope;
  const offset = Number(url.searchParams.get("offset") ?? 0);
  if (!(Number.isInteger(offset) && offset >= 0 && offset <= 100000))
    throw new HttpError(400, "Invalid offset.");
  let cursor: [number, string] | undefined;
  if (url.searchParams.has("cursor")) {
    try {
      cursor = JSON.parse(
        string(url.searchParams.get("cursor"), 200, "cursor"),
      );
    } catch {
      throw new HttpError(400, "Invalid cursor.");
    }
    if (
      !(
        Array.isArray(cursor) &&
        cursor.length === 2 &&
        Number.isSafeInteger(cursor[0]) &&
        cursor[0] >= 0 &&
        typeof cursor[1] === "string" &&
        cursor[1].length > 0 &&
        cursor[1].length <= 100
      )
    )
      throw new HttpError(400, "Invalid cursor.");
  }
  const revision =
    (await db.operations.scopeRevision(project, repo, branch).first())
      ?.version ?? 0;
  if (
    !cursor &&
    offset === 0 &&
    url.searchParams.get("revision") === String(revision)
  )
    return { notModified: true, revision };
  const requestedId = url.searchParams.get("id");
  const rows = await db.operations
    .threadPage(scope, {
      offset,
      cursor,
      id: requestedId ? string(requestedId, 100, "thread ID") : undefined,
    })
    .execute();
  const last = rows.results.at(-1);
  const nextCursor =
    rows.results.length === 50 && last
      ? JSON.stringify([last.created_at, last.id])
      : null;
  const ids = rows.results.map((row) => row.id);
  if (!ids.length) return { threads: [], next: null, revision };
  const comments = await db.operations.threadComments(ids).execute();
  const reactions = await db.operations.threadReactions(ids).execute();
  const commentsByThread = new Map<string, CommentRow[]>();
  for (const comment of comments.results) {
    const group = commentsByThread.get(comment.thread_id) ?? [];
    group.push(comment);
    commentsByThread.set(comment.thread_id, group);
  }
  const reactionsByComment = new Map<string, Comment["reactions"]>();
  for (const reaction of reactions.results) {
    const group = reactionsByComment.get(reaction.comment_id) ?? {};
    (group[reaction.emoji] ??= []).push(reaction.user_id);
    reactionsByComment.set(reaction.comment_id, group);
  }
  const threads: Thread[] = rows.results.map((row) => ({
    id: row.id,
    page: pagePath(row.page),
    anchor: JSON.parse(row.anchor),
    resolved: !!row.resolved,
    resolvedBy: row.resolved_by
      ? {
          id: row.resolved_by,
          name: row.resolver_name ?? "Reviewer",
          verified: !!row.resolver_verified,
        }
      : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    comments: (commentsByThread.get(row.id) ?? []).map((c) => ({
      id: c.id,
      body: c.body,
      author: {
        id: c.user_id,
        name: c.name,
        verified: !!c.verified,
        avatarUrl: c.avatar_url || undefined,
        accentColor: c.accent_color || undefined,
      },
      createdAt: c.created_at,
      editedAt: c.edited_at,
      reactions: reactionsByComment.get(c.id) ?? {},
    })),
  }));
  if (url.searchParams.get("authors") === "1") {
    const authors: Record<string, Identity> = Object.create(null);
    const authorId = (author: Identity) => {
      authors[author.id] = { ...authors[author.id], ...author };
      return author.id;
    };
    return {
      threads: threads.map((thread) => ({
        ...thread,
        resolvedBy: thread.resolvedBy ? authorId(thread.resolvedBy) : null,
        comments: thread.comments.map((comment) => ({
          ...comment,
          author: authorId(comment.author),
        })),
      })),
      authors,
      nextCursor,
      next: ids.length === 50 ? offset + 50 : null,
      revision,
    };
  }
  return {
    threads,
    nextCursor,
    next: ids.length === 50 ? offset + 50 : null,
    revision,
  };
}
