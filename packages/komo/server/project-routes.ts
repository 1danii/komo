import { createMiddleware } from "hono/factory";
import { sql } from "drizzle-orm";
import { authenticateSession } from "./auth-sessions";
import { digest } from "./digest";
import { importProject } from "./import-project";
import { projectFactory, type AuthenticatedProjectEnv } from "./komo-context";
import { privateAccess } from "./project-management";
import { projectSites, saveProjectSites } from "./project-sites";
import { bodySchemas, validateBody } from "./request-validation";
import { string, HttpError } from "./validation";
import { googleOwner } from "./workspaces";
type ManagedProjectEnv = AuthenticatedProjectEnv & {
  Variables: { managedProject: string };
};
/** Project routes keep invitation acceptance ahead of owner-only operations. */
export const projectRoutes = projectFactory
  .createApp()
  .use(
    "*",
    createMiddleware<ManagedProjectEnv>(async (c, next) => {
      const user = await authenticateSession(c.req.raw, c.env, c.var.project);
      const target =
        c.var.project === "_komo"
          ? string(c.req.query("workspace"), 100, "workspace")
          : c.var.project;
      c.set("user", user);
      c.set("managedProject", target);
      await next();
    }),
  )
  .post(
    "/join",
    async (c, next) => {
      const { user } = c.var;
      if (!(user.verified && user.id.startsWith("google:")))
        throw new HttpError(
          403,
          "Sign in with Google to accept an invitation.",
        );
      await next();
    },
    ...validateBody(bodySchemas.projectJoin),
    async (c) => {
      const env = c.env;
      const { managedProject: project, user } = c.var;

      const data = c.req.valid("json");
      const email = (await env.DB.operations.userById(user.id).first())?.email;
      if (!email)
        throw new HttpError(
          403,
          "Sign out and sign in with Google again to verify your email.",
        );
      const tokenHash = await digest(string(data.invite, 200, "invitation"));
      const result = await env.DB.batch([
        env.DB.raw(
          sql`INSERT INTO project_access(project,user_id) SELECT project,${user.id} FROM project_invites WHERE token_hash=${tokenHash} AND project=${project} AND email=${email} AND expires_at>${Date.now()} ON CONFLICT DO NOTHING`,
        ),
        env.DB.raw(
          sql`INSERT INTO project_members(project,user_id) SELECT project,${user.id} FROM project_invites WHERE token_hash=${tokenHash} AND project=${project} AND email=${email} AND expires_at>${Date.now()} ON CONFLICT DO NOTHING`,
        ),
        env.DB.raw(
          sql`DELETE FROM project_invites WHERE token_hash=${tokenHash} AND project=${project} AND email=${email} AND expires_at>${Date.now()}`,
        ),
      ]);
      if (!result[2].meta.changes)
        throw new HttpError(
          403,
          "Invitation expired, already used, or belongs to another Google account.",
        );
      return c.json({ ok: true });
    },
  )
  .use("*", async (c, next) => {
    await googleOwner(c.env, c.var.managedProject, c.var.user);
    await next();
  })
  .get("/sites", async (c) => {
    const env = c.env;
    const { managedProject: project } = c.var;
    return c.json({
      sites: await projectSites(env, project),
      fixed: [],
    });
  })
  .patch("/sites", ...validateBody(bodySchemas.projectSites), async (c) => {
    const request = c.req.raw,
      env = c.env,
      url = new URL(request.url);
    const { managedProject: project } = c.var;
    const managed = url.searchParams.get("project") === "_komo";

    const sites = await saveProjectSites(
      env,
      project,
      c.req.valid("json").sites,
      managed ? undefined : (request.headers.get("Origin") ?? undefined),
    );
    return c.json({ sites, fixed: [] });
  })
  .post("/import", ...validateBody(bodySchemas.projectImport), async (c) => {
    const env = c.env;
    const { managedProject: project } = c.var;

    return importProject(env, project, c.req.valid("json"));
  })
  .get("/", async (c) => {
    const env = c.env;
    const { managedProject: project } = c.var;
    const members = await env.DB.operations.projectMembers(project).execute();
    const invites = await env.DB.operations
      .projectInvites(project, Date.now())
      .execute();
    const hosted = !!(await env.DB.operations.workspaceById(project).first());
    return c.json({
      project,
      access: (await privateAccess(env, project)) ? "private" : "public",
      members: members.results,
      invites: invites.results,
      hosted,
    });
  })
  .patch("/", ...validateBody(bodySchemas.project), async (c) => {
    const env = c.env;
    const { managedProject: project } = c.var;

    const data = c.req.valid("json");
    if (!(data.access === "public" || data.access === "private"))
      throw new HttpError(400, "Choose public or private access.");
    await env.DB.operations.setProjectAccess(project, data.access).execute();
    return c.json({ ok: true });
  })
  .post("/invites", ...validateBody(bodySchemas.projectInvite), async (c) => {
    const request = c.req.raw,
      env = c.env,
      url = new URL(request.url);
    const { managedProject: project } = c.var;

    const data = c.req.valid("json"),
      email = string(data.email, 254, "email").toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      throw new HttpError(400, "Enter a valid email address.");
    const invite = crypto.randomUUID() + crypto.randomUUID();
    const result = await env.DB.raw(
      sql`INSERT INTO project_invites(token_hash,project,email,expires_at) SELECT ${await digest(invite)},${project},${email},${Date.now() + 7 * 86400000} WHERE (SELECT COUNT(*) FROM project_invites WHERE project=${project} AND expires_at>${Date.now()})<50`,
    ).execute();
    if (!result.meta.changes)
      throw new HttpError(
        409,
        "This project has 50 pending invitations. Revoke an invitation first.",
      );
    return c.json(
      {
        invite,
        url: `${url.origin}/setup?project=${encodeURIComponent(project)}#invite=${encodeURIComponent(invite)}`,
        expiresInDays: 7,
      },
      201,
    );
  })
  .delete("/invites", ...validateBody(bodySchemas.projectInvite), async (c) => {
    const env = c.env;
    const { managedProject: project } = c.var;

    const data = c.req.valid("json");
    await env.DB.operations
      .deleteProjectInvite(
        project,
        string(data.email, 254, "email").toLowerCase(),
      )
      .execute();
    return c.json({ ok: true });
  })
  .delete("/members", ...validateBody(bodySchemas.projectMember), async (c) => {
    const env = c.env;
    const { managedProject: project, user } = c.var;

    const data = c.req.valid("json"),
      member = string(data.user, 150, "member");
    if (member === user.id)
      throw new HttpError(400, "The owner cannot be removed.");
    await env.DB.batch([
      env.DB.operations.deleteProjectMember(project, member),
      env.DB.operations.deleteMemberSessions(project, member),
    ]);
    return c.json({ ok: true });
  })
  .get("/export", async (c) => {
    const request = c.req.raw,
      env = c.env,
      url = new URL(request.url);
    const { managedProject: project } = c.var;
    const table = url.searchParams.get("table") ?? "threads";
    const queries = {
      threads: env.DB.operations.exportThreads,
      comments: env.DB.operations.exportComments,
      reactions: env.DB.operations.exportReactions,
      users: env.DB.operations.exportUsers,
    };
    if (!Object.hasOwn(queries, table))
      throw new HttpError(400, "Invalid export table.");
    const offset = Number(url.searchParams.get("offset") ?? 0);
    if (!(Number.isInteger(offset) && offset >= 0 && offset <= 1000000))
      throw new HttpError(400, "Invalid export offset.");
    const [versionResult, rows] = await env.DB.batch([
      env.DB.operations.exportRevision(project),
      queries[table as keyof typeof queries](project, offset),
    ]);
    const revision = versionResult.results[0]?.version ?? 0;
    const expected = url.searchParams.get("revision");
    if (!(expected === null || expected === String(revision)))
      throw new HttpError(
        409,
        "Comments changed during export. Please retry the export.",
      );
    return c.json({
      revision,
      format: "komo-export",
      version: 1,
      project,
      table,
      rows: rows.results,
      next: rows.results.length === 200 ? offset + 200 : null,
    });
  })
  .post("/clear-resolved", ...validateBody(bodySchemas.project), async (c) => {
    const env = c.env;
    const { managedProject: project } = c.var;

    const data = c.req.valid("json");
    if (data.confirm !== project)
      throw new HttpError(
        400,
        "Confirm the project key to permanently remove resolved threads.",
      );
    const ids = data.threadIds;
    if (
      !(
        ids === undefined ||
        (Array.isArray(ids) &&
          ids.length > 0 &&
          ids.length <= 250 &&
          ids.every((id) => typeof id === "string" && id.length <= 100))
      )
    )
      throw new HttpError(400, "Choose 1–250 resolved threads.");
    const result = await env.DB.operations
      .clearResolvedThreads(project, ids as string[] | undefined)
      .execute();
    return c.json({ ok: true, deleted: result.results.length });
  })
  .delete("/", ...validateBody(bodySchemas.project), async (c) => {
    const env = c.env;
    const { managedProject: project } = c.var;

    const data = c.req.valid("json");
    if (data.confirm !== project)
      throw new HttpError(
        400,
        "Confirm the project key to permanently delete this project.",
      );
    if (!(await env.DB.operations.workspaceById(project).first()))
      throw new HttpError(
        400,
        "Self-hosted projects must be removed from the Worker configuration. Export or clear resolved comments here.",
      );
    await env.DB.batch([
      env.DB.operations.deleteProjectThreads(project),
      ...env.DB.operations.deleteProjectRecords(project),
      env.DB.operations.deleteWorkspace(project),
    ]);
    return c.json({ ok: true });
  })
  .on(["GET", "POST", "PATCH", "DELETE"], ["/", "/*"], (c) =>
    c.json({ error: "Unknown project action." }, 404),
  );
