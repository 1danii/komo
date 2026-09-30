import { accountRoutes } from "./account-routes";
import { komoFactory } from "./komo-context";
import { requireProjectOwner, resolveProject } from "./project-middleware";
import { enforceRequestLimit } from "./request-limits";
import setupClient from "./setup-client.txt";
import { setupRoutes } from "./setup-routes";
import { threadRoutes } from "./thread-routes";
import { HttpError, localOrigin, originAllowed } from "./validation";
import { configRoutes, workspaceRoutes } from "./workspace-routes";
import { projectConfig } from "./workspaces";

const unavailableMessage = "Comments are temporarily unavailable. Try again.";

// Wrap success and error responses in the same project-specific CORS policy.
const projectResponseHeaders = komoFactory.createMiddleware(async (c, next) => {
  await next();
  const url = new URL(c.req.url);
  const project = url.searchParams.get("project");
  let config: { origins: string[] } | undefined;
  try {
    config = project
      ? project === "_komo" && c.env.KOMO_HOSTED === "true"
        ? { origins: [url.origin] }
        : await projectConfig(c.env, project)
      : undefined;
  } catch {
    // Do not leak a successful body or allow CORS without a known site policy.
    c.res = c.json({ error: unavailableMessage }, 500);
  }
  const refusedSite =
    c.error instanceof HttpError &&
    c.error.code === "site_not_approved" &&
    url.pathname === "/config";
  const origin = c.req.header("Origin") ?? "";
  if (
    config &&
    (originAllowed(origin, config.origins) ||
      (project !== "_komo" && localOrigin(origin)) ||
      (refusedSite && originAllowed(origin, [origin])))
  ) {
    c.header("Access-Control-Allow-Origin", origin);
    c.header(
      "Access-Control-Allow-Methods",
      "GET, POST, PATCH, DELETE, OPTIONS",
    );
    c.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    c.header("Access-Control-Max-Age", "600");
  }
  c.header("Vary", "Origin");
  c.header("Cache-Control", "no-store");
  c.header("X-Content-Type-Options", "nosniff");
});

const serviceRequestPolicy = komoFactory.createMiddleware(async (c, next) => {
  if (c.env.KOMO_PAUSED === "true")
    throw new HttpError(503, "komo is temporarily paused.");
  if (c.env.EDGE_LIMIT) {
    const allowed = await c.env.EDGE_LIMIT.limit({
      key: c.req.header("CF-Connecting-IP") ?? "local",
    });
    if (!allowed.success)
      throw new HttpError(429, "Too many requests. Try again shortly.");
  }
  // The edge limiter is per-location; daily budgets remain database-backed.
  if (c.env.KOMO_HOSTED === "true")
    await enforceRequestLimit(c.env, "service:requests", 100000, 86400);
  await next();
});

/** Compose route groups in policy order to preserve access checks and quota accounting. */
export const komoApp = komoFactory
  .createApp()
  .onError((error, c) => {
    if (error instanceof HttpError) {
      // Unapproved sites may read why /config refused them, and nothing else.
      if (
        error.code === "site_not_approved" &&
        c.req.path === "/config" &&
        c.req.method === "OPTIONS"
      )
        return c.body(null, 204);
      return c.json(
        error.code
          ? { error: error.message, code: error.code }
          : { error: error.message },
        error.status,
      );
    }
    if (error.message.includes("komo_quota_exceeded"))
      return c.json(
        {
          error:
            "This workspace reached its storage or comment limit. Export your feedback or use your own deployment.",
        },
        409,
      );
    console.error("comments_request_failed", { path: c.req.path });
    return c.json({ error: unavailableMessage }, 500);
  })
  .use(projectResponseHeaders)
  .all("/health", (c) => c.json({ ok: true, version: c.env.KOMO_VERSION?.id }))
  .get("/setup-client.js", (c, next) => {
    if (c.req.method !== "GET") return next();
    c.header("Content-Type", "text/javascript; charset=utf-8");
    return c.body(setupClient);
  })
  .use(serviceRequestPolicy)
  .route("/", setupRoutes)
  .use(resolveProject)
  .route("/", workspaceRoutes)
  .use(requireProjectOwner)
  .route("/", configRoutes)
  .route("/", accountRoutes)
  .route("/", threadRoutes);
