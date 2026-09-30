import { projectFactory } from "./komo-context";
import { enforceRequestLimit } from "./request-limits";
import { HttpError, localOrigin, originAllowed, string } from "./validation";
import { maintain, projectConfig, type Project } from "./workspaces";
/** Resolve project policy before consuming per-project request and write budgets. */
export const resolveProject = projectFactory.createMiddleware(
  async (c, next) => {
    const request = c.req.raw,
      env = c.env,
      url = new URL(request.url);
    const project = string(url.searchParams.get("project"), 100, "project");
    const config: Project | undefined =
      project === "_komo" && env.KOMO_HOSTED === "true"
        ? { repo: "_komo", origins: [url.origin], allowGuests: false }
        : await projectConfig(env, project);
    if (!config) throw new HttpError(404, "Unknown comments project.");
    const origin =
      request.headers.get("Origin") ??
      (request.headers.get("Sec-Fetch-Site") === "same-origin"
        ? url.origin
        : "");
    if (
      !(
        originAllowed(origin, config.origins) ||
        (project !== "_komo" && localOrigin(origin)) ||
        (origin === url.origin &&
          [
            "/auth/google/start",
            "/project",
            "/project/join",
            "/project/invites",
            "/project/members",
            "/project/export",
            "/project/import",
            "/project/clear-resolved",
            "/owner/claim",
            "/config",
            "/me",
            "/usage",
          ].includes(url.pathname))
      )
    )
      throw new HttpError(
        403,
        "This site is not approved for this komo project.",
        "site_not_approved",
      );
    if (request.method === "OPTIONS")
      return new Response(null, { status: 204 });
    if (
      !(
        project !== "_komo" ||
        url.pathname.startsWith("/project") ||
        [
          "/setup/complete",
          "/workspace/verify",
          "/workspace/sites",
          "/workspace",
          "/usage",
          "/auth/google/start",
          "/me",
          "/config",
        ].includes(url.pathname)
      )
    )
      throw new HttpError(404, "Unknown management route.");
    if (!["GET", "POST", "PATCH", "DELETE"].includes(request.method))
      throw new HttpError(405, "Method not allowed.");
    const ip = request.headers.get("CF-Connecting-IP") ?? "local";
    if (config.suspended)
      throw new HttpError(403, "This workspace is suspended.");
    await enforceRequestLimit(env, `${project}:read:${ip}`, 180);
    await enforceRequestLimit(env, `${project}:requests`, 100000, 86400);
    if (request.method !== "GET") {
      await enforceRequestLimit(env, `${project}:write:${ip}`, 90);
      await enforceRequestLimit(
        env,
        `${project}:writes`,
        config.writesPerDay ?? 10000,
        86400,
      );
    }
    const owner = config.requireOwner
      ? await env.DB.operations.projectOwner(project).first()
      : null;
    c.set("project", project);
    c.set("config", config);
    c.set("origin", origin);
    c.set("ip", ip);
    c.set("owner", owner);
    await next();
  },
);
/** Require claimed ownership after allowing the setup and management routes. */
export const requireProjectOwner = projectFactory.createMiddleware(
  async (c, next) => {
    const request = c.req.raw,
      env = c.env,
      url = new URL(request.url),
      ctx = c.executionCtx;
    const { config, owner } = c.var;
    if (
      config.requireOwner &&
      !owner &&
      !["/config", "/auth/google/start", "/me"].includes(url.pathname)
    )
      throw new HttpError(
        403,
        "A Google-authenticated owner must finish workspace setup first.",
      );
    if (env.KOMO_HOSTED !== "true") ctx.waitUntil(maintain(env.DB));

    await next();
  },
);
