import type { DatabaseRow } from "./database-operations";
import { createMiddleware } from "hono/factory";
import { sql } from "drizzle-orm";
import { authenticateSession } from "./auth-sessions";
import {
  projectFactory,
  type AuthenticatedProjectEnv,
  type ProjectHttpEnv,
} from "./komo-context";
import { privateAccess, requireMember } from "./project-management";
import { enforceRequestLimit } from "./request-limits";
import { bodySchemas, validateBody } from "./request-validation";
import { listThreadPage } from "./thread-list";
import { anchorValue, HttpError, string } from "./validation";
import { retainReviewerComments } from "./workspaces";
type ThreadScopeEnv = ProjectHttpEnv & {
  Variables: { repo: string; branch: string };
};
type ThreadWriteEnv = ThreadScopeEnv &
  AuthenticatedProjectEnv & { Variables: { now: number } };
type ThreadRecordEnv = ThreadWriteEnv & {
  Variables: {
    threadId: string;
    commentId: string | undefined;
    reaction: string | undefined;
  };
};
type CommentRecordEnv = ThreadRecordEnv & {
  Variables: { comment: DatabaseRow<"comments"> };
};
/** Scope every thread read and mutation to project, repository, and branch. */
export const threadRoutes = projectFactory
  .createApp()
  .use(
    "*",
    createMiddleware<ThreadScopeEnv>(async (c, next) => {
      const request = c.req.raw,
        env = c.env,
        url = new URL(request.url);
      const { project, config } = c.var;
      if (await privateAccess(env, project)) {
        await requireMember(
          env,
          project,
          await authenticateSession(request, env, project),
        );
      }
      const requestedRepo = url.searchParams.get("repo");
      const repo =
        !requestedRepo || requestedRepo === project
          ? config.repo
          : string(requestedRepo, 200, "repository");
      const branch = string(url.searchParams.get("branch"), 250, "branch");
      if (repo !== config.repo)
        throw new HttpError(403, "Repository does not match this project.");
      c.set("repo", repo);
      c.set("branch", branch);
      await next();
    }),
  )
  .get("/threads", async (c) =>
    c.json(await listThreadPage(c.env.DB, c.var, new URL(c.req.url))),
  )
  .use(
    "*",
    createMiddleware<ThreadWriteEnv>(async (c, next) => {
      const request = c.req.raw,
        env = c.env;
      const { project } = c.var;
      const user = await authenticateSession(request, env, project);
      await enforceRequestLimit(env, `${project}:session:${user.id}`, 60);
      const now = Date.now();
      c.set("user", user);
      c.set("now", now);
      await next();
    }),
  )
  .post("/threads", ...validateBody(bodySchemas.threadCreate), async (c) => {
    const env = c.env;
    const { project, config, repo, branch, user, now } = c.var;

    const data = c.req.valid("json");
    const text = data.body;
    const page = data.page;
    const anchor = data.anchor;
    const id = crypto.randomUUID();
    const firstCommentId = crypto.randomUUID();
    await env.DB.batch([
      env.DB.operations.insertThread({
        id: id,
        project: project,
        repo: repo,
        branch: branch,
        page: page,
        anchor: JSON.stringify(anchor),
        created_at: now,
        updated_at: now,
      }),
      env.DB.operations.insertComment({
        id: firstCommentId,
        thread_id: id,
        user_id: user.id,
        body: text,
        created_at: now,
      }),
      ...retainReviewerComments(
        env.DB,
        project,
        user.id,
        config.retainedCommentsPerUser,
      ),
    ]);
    return c.json({ id, commentId: firstCommentId }, 201);
  })
  .use(
    "*",
    createMiddleware<ThreadRecordEnv>(async (c, next) => {
      const request = c.req.raw,
        env = c.env,
        url = new URL(request.url);
      const { project, repo, branch } = c.var;
      const match = url.pathname.match(
        /^\/threads\/([\w:-]{1,100})(?:\/comments(?:\/([\w:-]{1,100})(?:\/(reactions))?)?)?$/,
      );
      if (!match) throw new HttpError(404, "Not found.");
      const [, threadId, commentId, reaction] = match;
      const thread = await env.DB.operations
        .scopedThread(threadId, project, repo, branch)
        .first();
      if (!thread) throw new HttpError(404, "Thread not found on this branch.");
      c.set("threadId", threadId);
      c.set("commentId", commentId);
      c.set("reaction", reaction);
      await next();
    }),
  )
  .patch(
    "/threads/:threadId",
    ...validateBody(bodySchemas.threadUpdate),
    async (c) => {
      const env = c.env;
      const { config, user, now, threadId } = c.var;

      const data = c.req.valid("json");
      if (data.anchor !== undefined) {
        const owner = await env.DB.operations
          .firstCommentAuthor(threadId)
          .first();
        if (!(user.verified || owner?.user_id === user.id))
          throw new HttpError(
            403,
            "Only the author or a signed-in reviewer can move this comment.",
          );
        const anchor = anchorValue(data.anchor);
        await env.DB.operations
          .updateThread(threadId, {
            anchor: JSON.stringify(anchor),
            updated_at: now,
          })
          .execute();
        return c.json({ ok: true });
      }
      if (!(user.verified || config.allowGuestResolve !== false))
        throw new HttpError(403, "Sign in to resolve comments.");
      if (typeof data.resolved !== "boolean")
        throw new HttpError(400, "Invalid resolved state.");
      await env.DB.operations
        .updateThread(threadId, {
          resolved: Number(data.resolved),
          resolved_by: data.resolved ? user.id : null,
          updated_at: now,
        })
        .execute();
      return c.json({ ok: true });
    },
  )
  .post(
    "/threads/:threadId/comments",
    ...validateBody(bodySchemas.reply),
    async (c) => {
      const env = c.env;
      const { project, config, user, now, threadId } = c.var;

      const data = c.req.valid("json");
      const text = data.body;
      const replyId = crypto.randomUUID();
      const result = await env.DB.batch([
        env.DB.raw(
          sql`INSERT INTO comments(id,thread_id,user_id,body,created_at) SELECT ${replyId},${threadId},${user.id},${text},${now} WHERE (SELECT COUNT(*) FROM comments WHERE thread_id=${threadId})<200`,
        ),
        env.DB.operations.updateThread(threadId, { updated_at: now }),
        ...retainReviewerComments(
          env.DB,
          project,
          user.id,
          config.retainedCommentsPerUser,
        ),
      ]);
      if (!result[0].meta.changes)
        throw new HttpError(
          409,
          "This thread has reached 200 comments. Start another thread.",
        );
      return c.json({ ok: true, id: replyId }, 201);
    },
  )
  .use(
    "*",
    createMiddleware<CommentRecordEnv>(async (c, next) => {
      const { commentId, threadId } = c.var;
      const env = c.env;
      if (!commentId) throw new HttpError(405, "Method not allowed.");
      const comment = await env.DB.operations
        .threadComment(commentId, threadId)
        .first();
      if (!comment) throw new HttpError(404, "Comment not found.");
      c.set("comment", comment);
      await next();
    }),
  )
  .post(
    "/threads/:threadId/comments/:commentId/reactions",
    ...validateBody(bodySchemas.reaction),
    async (c) => {
      const env = c.env;
      const { user, now, threadId, comment } = c.var;
      const commentId = comment.id;

      const data = c.req.valid("json");
      await env.DB.batch([
        ...(data.active
          ? [env.DB.operations.deleteReactions(commentId, user.id)]
          : []),
        data.active
          ? env.DB.operations.insertReaction(commentId, user.id, data.emoji)
          : env.DB.operations.deleteReactions(commentId, user.id, data.emoji),
        env.DB.operations.updateThread(threadId, { updated_at: now }),
      ]);
      return c.json({ ok: true });
    },
  )
  .use("*", async (c, next) => {
    const { reaction, comment, user } = c.var;
    if (reaction || comment.user_id !== user.id)
      throw new HttpError(403, "Only the author can change this comment.");
    await next();
  })
  .patch(
    "/threads/:threadId/comments/:commentId",
    ...validateBody(bodySchemas.commentEdit),
    async (c) => {
      const env = c.env;
      const { now, threadId, comment } = c.var;
      const commentId = comment.id;

      const data = c.req.valid("json");
      await env.DB.batch([
        env.DB.operations.updateComment(
          commentId,
          string(data.body, 4000, "comment"),
          now,
        ),
        env.DB.operations.updateThread(threadId, { updated_at: now }),
      ]);
      return c.json({ ok: true });
    },
  )
  .delete("/threads/:threadId/comments/:commentId", async (c) => {
    const env = c.env;
    const { now, threadId, comment } = c.var;
    const commentId = comment.id;
    await env.DB.batch([
      env.DB.operations.updateComment(commentId, "[Comment deleted]", now),
      env.DB.operations.deleteReactions(commentId),
      env.DB.operations.updateThread(threadId, { updated_at: now }),
    ]);
    return c.json({ ok: true });
  })
  .all("*", () => {
    throw new HttpError(405, "Method not allowed.");
  });
