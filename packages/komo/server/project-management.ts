import { importProject } from "./import-project";
import { projectSites, saveProjectSites } from "./project-sites";
import { check, string } from "./validation";
import { googleOwner } from "./workspaces";
import type { Identity } from "../src/types";

import { digest } from "./digest";
export async function privateAccess(env: Env, project: string) {
  return (
    (
      await env.DB.prepare(
        "SELECT access FROM project_settings WHERE project=?"
      )
        .bind(project)
        .first<{ access: string }>()
    )?.access === "private"
  );
}
export async function requireMember(env: Env, project: string, user: Identity) {
  check(
    user.verified && user.id.startsWith("google:"),
    403,
    "Sign in with your invited Google account."
  );
  const access = await env.DB.prepare(
    "SELECT user_id FROM project_owners WHERE project=? AND user_id=? UNION SELECT user_id FROM project_access WHERE project=? AND user_id=?"
  )
    .bind(project, user.id, project, user.id)
    .first();
  check(
    access,
    403,
    "This project is invite-only. Ask its owner for an invitation."
  );
}

export async function manageProject(
  request: Request,
  env: Env,
  project: string,
  user: Identity,
  readBody: () => Promise<Record<string, unknown>>
): Promise<Response> {
  const url = new URL(request.url),
    path = url.pathname;
  if (path === "/project/join" && request.method === "POST") {
    check(
      user.verified && user.id.startsWith("google:"),
      403,
      "Sign in with Google to accept an invitation."
    );
    const data = await readBody();
    const email = (
      await env.DB.prepare("SELECT email FROM users WHERE id=?")
        .bind(user.id)
        .first<{ email: string }>()
    )?.email;
    check(
      email,
      403,
      "Sign out and sign in with Google again to verify your email."
    );
    const tokenHash = await digest(string(data.invite, 200, "invitation"));
    const result = await env.DB.batch([
      env.DB.prepare(
        "INSERT OR IGNORE INTO project_access(project,user_id) SELECT project,? FROM project_invites WHERE token_hash=? AND project=? AND email=? AND expires_at>?"
      ).bind(user.id, tokenHash, project, email, Date.now()),
      env.DB.prepare(
        "INSERT OR IGNORE INTO project_members(project,user_id) SELECT project,? FROM project_invites WHERE token_hash=? AND project=? AND email=? AND expires_at>?"
      ).bind(user.id, tokenHash, project, email, Date.now()),
      env.DB.prepare(
        "DELETE FROM project_invites WHERE token_hash=? AND project=? AND email=? AND expires_at>?"
      ).bind(tokenHash, project, email, Date.now()),
    ]);
    check(
      result[2].meta.changes,
      403,
      "Invitation expired, already used, or belongs to another Google account."
    );
    return Response.json({ ok: true });
  }
  await googleOwner(env, project, user);
  // `fixed` stays empty for widgets released before every site was removable.
  if (path === "/project/sites" && request.method === "GET")
    return Response.json({
      sites: await projectSites(env, project),
      fixed: [],
    });
  if (path === "/project/sites" && request.method === "PATCH") {
    const managed = url.searchParams.get("project") === "_komo";
    const sites = await saveProjectSites(
      env,
      project,
      (await readBody()).sites,
      managed ? undefined : (request.headers.get("Origin") ?? undefined)
    );
    return Response.json({ sites, fixed: [] });
  }
  if (path === "/project/import" && request.method === "POST")
    return importProject(env, project, await readBody());
  if (path === "/project" && request.method === "GET") {
    const members = await env.DB.prepare(
      "SELECT u.id,u.name,u.email FROM project_access a JOIN users u ON u.id=a.user_id WHERE a.project=? ORDER BY u.name"
    )
      .bind(project)
      .all();
    const invites = await env.DB.prepare(
      "SELECT email,expires_at FROM project_invites WHERE project=? AND expires_at>? ORDER BY email"
    )
      .bind(project, Date.now())
      .all();
    const hosted = !!(await env.DB.prepare(
      "SELECT id FROM workspaces WHERE id=?"
    )
      .bind(project)
      .first());
    return Response.json({
      project,
      access: (await privateAccess(env, project)) ? "private" : "public",
      members: members.results,
      invites: invites.results,
      hosted,
    });
  }
  if (path === "/project" && request.method === "PATCH") {
    const data = await readBody();
    check(
      data.access === "public" || data.access === "private",
      400,
      "Choose public or private access."
    );
    await env.DB.prepare(
      "INSERT INTO project_settings(project,access) VALUES(?,?) ON CONFLICT(project) DO UPDATE SET access=excluded.access"
    )
      .bind(project, data.access)
      .run();
    return Response.json({ ok: true });
  }
  if (path === "/project/invites" && request.method === "POST") {
    const data = await readBody(),
      email = string(data.email, 254, "email").toLowerCase();
    check(
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
      400,
      "Enter a valid email address."
    );
    const invite = crypto.randomUUID() + crypto.randomUUID();
    const result = await env.DB.prepare(
      "INSERT INTO project_invites(token_hash,project,email,expires_at) SELECT ?,?,?,? WHERE (SELECT COUNT(*) FROM project_invites WHERE project=? AND expires_at>?)<50"
    )
      .bind(
        await digest(invite),
        project,
        email,
        Date.now() + 7 * 86400000,
        project,
        Date.now()
      )
      .run();
    check(
      result.meta.changes,
      409,
      "This project has 50 pending invitations. Revoke an invitation first."
    );
    return Response.json(
      {
        invite,
        url: `${url.origin}/setup?project=${encodeURIComponent(project)}#invite=${encodeURIComponent(invite)}`,
        expiresInDays: 7,
      },
      { status: 201 }
    );
  }
  if (path === "/project/invites" && request.method === "DELETE") {
    const data = await readBody();
    await env.DB.prepare(
      "DELETE FROM project_invites WHERE project=? AND email=?"
    )
      .bind(project, string(data.email, 254, "email").toLowerCase())
      .run();
    return Response.json({ ok: true });
  }
  if (path === "/project/members" && request.method === "DELETE") {
    const data = await readBody(),
      member = string(data.user, 150, "member");
    check(member !== user.id, 400, "The owner cannot be removed.");
    await env.DB.batch([
      env.DB.prepare(
        "DELETE FROM project_access WHERE project=? AND user_id=?"
      ).bind(project, member),
      env.DB.prepare("DELETE FROM sessions WHERE project=? AND user_id=?").bind(
        project,
        member
      ),
    ]);
    return Response.json({ ok: true });
  }
  if (path === "/project/export" && request.method === "GET") {
    const table = url.searchParams.get("table") ?? "threads";
    const queries: Record<string, string> = {
      threads:
        "SELECT id,repo,branch,page,anchor,resolved,resolved_by,created_at,updated_at FROM threads WHERE project=? ORDER BY id",
      comments:
        "SELECT c.id,c.thread_id,c.user_id,c.body,c.created_at,c.edited_at FROM comments c JOIN threads t ON t.id=c.thread_id WHERE t.project=? ORDER BY c.id",
      reactions:
        "SELECT r.* FROM reactions r JOIN comments c ON c.id=r.comment_id JOIN threads t ON t.id=c.thread_id WHERE t.project=? ORDER BY r.comment_id,r.user_id,r.emoji",
      users:
        "SELECT DISTINCT u.id,u.name,u.verified,u.avatar_url,u.accent_color FROM users u WHERE u.id IN (SELECT c.user_id FROM comments c JOIN threads t ON t.id=c.thread_id WHERE t.project=?) OR u.id IN (SELECT resolved_by FROM threads WHERE project=?) OR u.id IN (SELECT r.user_id FROM reactions r JOIN comments c ON c.id=r.comment_id JOIN threads t ON t.id=c.thread_id WHERE t.project=?) ORDER BY u.id",
    };
    check(Object.hasOwn(queries, table), 400, "Invalid export table.");
    const offset = Number(url.searchParams.get("offset") ?? 0);
    check(
      Number.isInteger(offset) && offset >= 0 && offset <= 1000000,
      400,
      "Invalid export offset."
    );
    const stmt = env.DB.prepare(`${queries[table]} LIMIT 200 OFFSET ?`);
    const [versionResult, rows] = await env.DB.batch([
      env.DB.prepare(
        "SELECT COALESCE((SELECT version FROM export_revisions WHERE project=?),0) AS version"
      ).bind(project),
      table === "users"
        ? stmt.bind(project, project, project, offset)
        : stmt.bind(project, offset),
    ]);
    const revision = (versionResult.results[0] as { version: number }).version;
    const expected = url.searchParams.get("revision");
    check(
      expected === null || expected === String(revision),
      409,
      "Comments changed during export. Please retry the export."
    );
    return Response.json({
      revision,
      format: "komo-export",
      version: 1,
      project,
      table,
      rows: rows.results,
      next: rows.results.length === 200 ? offset + 200 : null,
    });
  }
  if (path === "/project/clear-resolved" && request.method === "POST") {
    const data = await readBody();
    check(
      data.confirm === project,
      400,
      "Confirm the project key to permanently remove resolved threads."
    );
    const ids = data.threadIds;
    check(
      ids === undefined ||
        (Array.isArray(ids) &&
          ids.length > 0 &&
          ids.length <= 250 &&
          ids.every((id) => typeof id === "string" && id.length <= 100)),
      400,
      "Choose 1–250 resolved threads."
    );
    const result = await env.DB.prepare(
      "DELETE FROM threads WHERE project=? AND resolved=1" +
        (ids ? " AND id IN (SELECT value FROM json_each(?))" : "") +
        " RETURNING id"
    )
      .bind(...(ids ? [project, JSON.stringify(ids)] : [project]))
      .all();
    return Response.json({ ok: true, deleted: result.results.length });
  }
  if (path === "/project" && request.method === "DELETE") {
    const data = await readBody();
    check(
      data.confirm === project,
      400,
      "Confirm the project key to permanently delete this project."
    );
    check(
      await env.DB.prepare("SELECT id FROM workspaces WHERE id=?")
        .bind(project)
        .first(),
      400,
      "Self-hosted projects must be removed from the Worker configuration. Export or clear resolved comments here."
    );
    await env.DB.batch([
      env.DB.prepare("DELETE FROM threads WHERE project=?").bind(project),
      ...[
        "sessions",
        "project_members",
        "project_access",
        "project_invites",
        "project_settings",
        "project_owners",
        "project_quotas",
        "workspace_domains",
        "scope_revisions",
        "export_revisions",
      ].map((table) =>
        env.DB.prepare(`DELETE FROM ${table} WHERE project=?`).bind(project)
      ),
      env.DB.prepare("DELETE FROM oauth_states WHERE project=?").bind(project),
      env.DB.prepare("DELETE FROM setup_requests WHERE project=?").bind(
        project
      ),
      env.DB.prepare("DELETE FROM workspaces WHERE id=?").bind(project),
    ]);
    return Response.json({ ok: true });
  }
  return Response.json({ error: "Unknown project action." }, { status: 404 });
}
