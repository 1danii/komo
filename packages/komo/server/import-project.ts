import { isEmoji } from "../src/emoji";
import type { DatabaseStatement, KomoBackendEnv } from "./database-adapter";
import { digest } from "./digest";
import { anchorValue, pagePath, string, HttpError } from "./validation";

export async function importProject(
  env: KomoBackendEnv,
  project: string,
  data: Record<string, unknown>,
) {
  const source = string(data.source, 100, "source project");
  const kind = string(data.kind, 20, "table");
  if (
    !(
      Array.isArray(data.records) &&
      data.records.length > 0 &&
      data.records.length <= 50
    )
  )
    throw new HttpError(400, "Import 1–50 records at a time.");
  const repo =
    (await env.DB.operations.workspaceById(project).first())?.repo ??
    JSON.parse(env.PROJECTS)[project]?.repo;
  if (!repo) throw new HttpError(404, "Unknown destination project.");
  const id = async (value: unknown, identity = false) =>
    (identity ? "guest:import:" : "import:") +
    (await digest(`${project}\n${source}\n${string(value, 200, "source ID")}`));
  const time = (value: unknown) => {
    if (
      !(typeof value === "number" && Number.isSafeInteger(value) && value >= 0)
    )
      throw new HttpError(400, "Invalid timestamp.");
    return value;
  };
  const statements: DatabaseStatement[] = [];
  for (const value of data.records) {
    if (!(value && typeof value === "object" && !Array.isArray(value)))
      throw new HttpError(400, "Invalid record.");
    const row = value as Record<string, unknown>;
    if (kind === "users") {
      const accent = row.accent_color;
      if (
        !(
          accent === undefined ||
          accent === null ||
          (typeof accent === "string" && /^#[a-f0-9]{6}$/i.test(accent))
        )
      )
        throw new HttpError(400, "Invalid accent color.");
      const photo = row.avatar_url;
      if (
        !(
          photo === undefined ||
          photo === null ||
          (typeof photo === "string" &&
            photo.length <= 12000 &&
            (/^(https:\/\/|data:image\/jpeg;base64,)/.test(photo) ||
              photo === ""))
        )
      )
        throw new HttpError(400, "Invalid avatar.");
      const authorId = await id(row.id, true);
      statements.push(
        env.DB.operations.importUser({
          id: authorId,
          name: string(row.name, 60, "author name"),
          verified: 0,
          avatar_url: photo ?? null,
          accent_color: accent ?? null,
        }),
        env.DB.operations.insertProjectMember(project, authorId),
      );
    } else if (kind === "threads") {
      let rawAnchor = row.anchor;
      if (typeof rawAnchor === "string") {
        try {
          rawAnchor = JSON.parse(rawAnchor);
        } catch {
          throw new HttpError(400, "Invalid imported anchor.");
        }
      }
      const anchor = anchorValue(rawAnchor);
      if (!(row.resolved === 0 || row.resolved === 1))
        throw new HttpError(400, "Invalid resolved state.");
      statements.push(
        env.DB.operations.importThread({
          id: await id(row.id),
          project,
          repo,
          branch: string(row.branch, 250, "branch"),
          page: pagePath(row.page),
          anchor: JSON.stringify(anchor),
          resolved: row.resolved,
          resolved_by: row.resolved_by ? await id(row.resolved_by, true) : null,
          created_at: time(row.created_at),
          updated_at: time(row.updated_at),
        }),
      );
    } else if (kind === "comments") {
      const thread = await id(row.thread_id),
        author = await id(row.user_id, true);
      if (!(await env.DB.operations.projectThread(thread, project).first()))
        throw new HttpError(400, "Import the parent thread first.");
      statements.push(
        env.DB.operations.importComment({
          id: await id(row.id),
          thread_id: thread,
          user_id: author,
          body: string(row.body, 4000, "comment"),
          created_at: time(row.created_at),
          edited_at: row.edited_at == null ? null : time(row.edited_at),
        }),
      );
    } else if (kind === "reactions") {
      const comment = await id(row.comment_id);
      if (!(await env.DB.operations.projectComment(comment, project).first()))
        throw new HttpError(400, "Import the comment first.");
      if (!(typeof row.emoji === "string" && isEmoji(row.emoji)))
        throw new HttpError(400, "Invalid reaction.");
      statements.push(
        env.DB.operations.importReaction({
          comment_id: comment,
          user_id: await id(row.user_id, true),
          emoji: row.emoji,
        }),
      );
    } else throw new HttpError(400, "Unknown import table.");
  }
  const results = await env.DB.batch(statements);
  return Response.json({
    ok: true,
    imported: results.reduce(
      (total, result, index) =>
        total + (kind === "users" && index % 2 ? 0 : result.results.length),
      0,
    ),
  });
}
