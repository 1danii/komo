import { createMiddleware } from "hono/factory";
import { authenticateSession } from "./auth-sessions";
import { digest } from "./digest";
import {
  projectFactory,
  type AuthenticatedProjectEnv,
  type ProjectContext,
} from "./komo-context";
import { privateAccess, requireMember } from "./project-management";
import { projectRoutes } from "./project-routes";
import { projectSites, saveProjectSites } from "./project-sites";
import { bodySchemas, validateBody } from "./request-validation";
import { originAllowed, string, HttpError } from "./validation";
import { completeSetup } from "./workspace-setup";
import { googleOwner, projectConfig, type Project } from "./workspaces";
const workspaceSiteRoutes = projectFactory.createApp().post(
  "/",
  createMiddleware<AuthenticatedProjectEnv>(async (c, next) => {
    const request = c.req.raw,
      env = c.env;
    const { project } = c.var;
    if (project !== "_komo") return next();
    const user = await authenticateSession(request, env, project);
    c.set("user", user);
    await next();
  }),
  ...validateBody(
    bodySchemas.workspaceSite,
    false,
    (c: ProjectContext) => c.var.project === "_komo",
  ),
  async (c, next) => {
    const env = c.env;
    const { project } = c.var;
    const user = c.var.user;
    if (project !== "_komo") return next();
    const data = c.req.valid("json");
    const target = string(data.project, 100, "project");
    await googleOwner(env, target, user);
    const origin = string(data.origin, 300, "origin");
    if (
      !(
        (await projectConfig(env, target)) &&
        origin.startsWith("https://") &&
        originAllowed(origin, [origin])
      )
    )
      throw new HttpError(
        400,
        "Use an exact HTTPS origin for a hosted workspace.",
      );
    const sites = await projectSites(env, target);
    if (!sites.includes(origin))
      await saveProjectSites(env, target, [...sites, origin]);
    return c.json({ ok: true });
  },
);
/** Workspace management authenticates ownership even before initial owner claims. */
export const workspaceRoutes = projectFactory
  .createApp()
  .post(
    "/setup/complete",
    createMiddleware<AuthenticatedProjectEnv>(async (c, next) => {
      const request = c.req.raw,
        env = c.env;
      const { project } = c.var;
      if (!(project === "_komo" && env.KOMO_HOSTED === "true")) return next();
      const user = await authenticateSession(request, env, project);
      if (!(user.verified && user.id.startsWith("google:")))
        throw new HttpError(403, "Sign in with Google to own a workspace.");
      c.set("user", user);
      await next();
    }),
    ...validateBody(
      bodySchemas.setupComplete,
      false,
      (c: ProjectContext) =>
        c.var.project === "_komo" && c.env.KOMO_HOSTED === "true",
    ),
    async (c, next) => {
      const env = c.env;
      const { project } = c.var;
      const user = c.var.user;
      if (!(project === "_komo" && env.KOMO_HOSTED === "true")) return next();
      const data = c.req.valid("json");
      const code = string(data.code, 100, "setup code");
      const created = await completeSetup(env, user, code);
      return c.json(created, 201);
    },
  )
  .route("/workspace/sites", workspaceSiteRoutes)
  .route("/workspace/verify", workspaceSiteRoutes)
  .get("/workspace", async (c, next) => {
    const request = c.req.raw,
      env = c.env,
      url = new URL(request.url);
    const { project } = c.var;
    if (project !== "_komo") return next();
    const user = await authenticateSession(request, env, project);
    const target = string(url.searchParams.get("workspace"), 100, "workspace");
    await googleOwner(env, target, user);
    const config = await projectConfig(env, target);
    if (!config) throw new HttpError(404, "Workspace not found.");
    const workspace = await env.DB.operations.workspaceById(target).first();
    return c.json({
      repo: config.repo,
      sites: await projectSites(env, target),
      suggested: workspace
        ? (JSON.parse(workspace.origins) as string[]).filter((origin) =>
            origin.startsWith("https://"),
          )
        : [],
    });
  })
  .route("/project", projectRoutes)
  .post(
    "/owner/claim",
    createMiddleware<AuthenticatedProjectEnv>(async (c, next) => {
      const request = c.req.raw,
        env = c.env;
      const { project } = c.var;
      const user = await authenticateSession(request, env, project);
      if (!(user.verified && user.id.startsWith("google:")))
        throw new HttpError(403, "Sign in with Google to own a workspace.");
      c.set("user", user);
      await next();
    }),
    ...validateBody(bodySchemas.ownerClaim),
    async (c) => {
      const env = c.env;
      const { project, config } = c.var;
      const user = c.var.user;

      const data = c.req.valid("json");
      if (
        !(
          config.bootstrapHash &&
          (await digest(string(data.key, 200, "setup key"))) ===
            config.bootstrapHash
        )
      )
        throw new HttpError(403, "Invalid owner setup key.");
      const result = await env.DB.operations
        .insertProjectOwner(project, user.id)
        .execute();
      if (!result.meta.changes)
        throw new HttpError(409, "This workspace already has an owner.");
      return c.json({ ok: true });
    },
  );
/** Expose project configuration publicly and usage only to authorized identities. */
export const configRoutes = projectFactory
  .createApp()
  .get("/config", async (c) => {
    const env = c.env;
    const { project, config, owner } = c.var;
    return c.json({
      repo: config.repo,
      github: !!(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET),
      google: !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
      guests:
        config.allowGuests !== false &&
        (!config.requireOwner || !!owner) &&
        !(await privateAccess(env, project)),
      private: await privateAccess(env, project),
      guestResolve: config.allowGuestResolve !== false,
    });
  })
  .get("/usage", async (c) => {
    const request = c.req.raw,
      env = c.env,
      url = new URL(request.url);
    const { project } = c.var;
    const user = await authenticateSession(request, env, project);
    const target =
      project === "_komo"
        ? string(url.searchParams.get("workspace"), 100, "workspace")
        : project;
    if (project === "_komo") await googleOwner(env, target, user);
    else if (await privateAccess(env, target))
      await requireMember(env, target, user);
    const quota = await env.DB.operations.projectQuota(target).first();
    const workspace = await env.DB.operations.workspaceById(target).first();
    const owned =
      workspace && user.verified && user.id.startsWith("google:")
        ? await env.DB.operations.workspaceCount(user.id).first()
        : null;
    const count = quota
      ? quota.comments
      : ((await env.DB.operations.projectCommentCount(target).first())?.used ??
        0);
    let projects: { used: number; limit: number | null } | null = owned
      ? { used: owned.used, limit: 3 }
      : null;
    if (!workspace) {
      const connected = await env.DB.operations
        .connectedProjects(user.id)
        .execute();
      const configured = JSON.parse(env.PROJECTS) as Record<string, Project>;
      const ids = new Set([
        target,
        ...connected.results.map((row) => row.project),
      ]);
      projects = {
        used: [...ids].filter((id) => Object.hasOwn(configured, id)).length,
        limit: null,
      };
    }
    return c.json({
      hosted: !!workspace,
      projects,
      comments: { used: count, limit: quota?.max_comments ?? null },
    });
  });
