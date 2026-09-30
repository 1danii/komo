import { createSessionToken } from "./auth-sessions";
import { digest } from "./digest";
import { komoFactory } from "./komo-context";
import { oauthAuthorize, oauthCallback } from "./oauth-routes";
import { enforceRequestLimit } from "./request-limits";
import { bodySchemas, validateBody } from "./request-validation";
import { setupPage } from "./setup-page";
import { HttpError, originAllowed, string } from "./validation";
import { workspaceConfig } from "./workspaces";

/** Hosted setup and OAuth callbacks are available before project policy resolution. */
export const setupRoutes = komoFactory
  .createApp()
  // Hono routes HEAD through GET. This GET starts OAuth, so reject HEAD before it runs.
  .use("/setup/connect", async (c, next) => {
    if (c.req.method === "HEAD")
      throw new HttpError(405, "Method not allowed.");
    await next();
  })
  .get("/setup/connect", async (c, next) => {
    const request = c.req.raw,
      env = c.env,
      url = new URL(request.url);

    if (env.KOMO_HOSTED !== "true") return next();
    if (!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET))
      throw new HttpError(503, "Google sign-in is not configured.");
    await enforceRequestLimit(
      env,
      `connect:${request.headers.get("CF-Connecting-IP") ?? "local"}`,
      20,
      3600,
    );
    const code = string(url.searchParams.get("code"), 100, "setup code");
    const origin = string(url.searchParams.get("origin"), 300, "site origin");
    const setup = await env.DB.operations
      .pendingSetup(code, Date.now())
      .first();
    if (!setup)
      throw new HttpError(
        409,
        "Setup expired or already completed. Run komo init again.",
      );
    if (!originAllowed(origin, JSON.parse(setup.config).origins))
      throw new HttpError(403, "Open the site configured by komo init.");
    let sites: unknown;
    try {
      sites = JSON.parse(
        url.searchParams.get("sites") || JSON.stringify([origin]),
      );
    } catch {
      throw new HttpError(400, "Invalid site addresses.");
    }
    if (
      !(
        Array.isArray(sites) &&
        sites.length > 0 &&
        sites.length <= 10 &&
        sites.includes(origin) &&
        sites.every(
          (site) =>
            typeof site === "string" &&
            site.length <= 300 &&
            originAllowed(site, [site]) &&
            (site.startsWith("https://") || site === origin),
        )
      )
    )
      throw new HttpError(
        400,
        "Use up to ten exact HTTPS sites, including your current site.",
      );
    const approved = [...new Set(sites)];
    const state = createSessionToken();
    await env.DB.operations
      .insertOAuthState({
        state_hash: await digest(state),
        verifier: createSessionToken(),
        project: `setup:${code}`,
        origin: origin,
        expires_at: Date.now() + 600000,
        exchange_hash: await digest(createSessionToken()),
        provider: "google",
        approved_origins: JSON.stringify(approved),
      })
      .execute();
    const authorize = new URL("/auth/google/authorize", url);
    authorize.searchParams.set("state", state);
    return oauthAuthorize(new Request(authorize), env, "google");
  })
  .all("/setup", async () => {
    return setupPage();
  })
  .post(
    "/setup/start",
    async (c, next) => {
      const request = c.req.raw,
        env = c.env;
      if (env.KOMO_HOSTED !== "true") return next();
      await enforceRequestLimit(
        env,
        `setup:${request.headers.get("CF-Connecting-IP") ?? "local"}`,
        10,
        3600,
      );
      if (!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET))
        throw new HttpError(
          503,
          "Hosted setup is awaiting Google sign-in configuration. Use --self-host or try again later.",
        );
      await next();
    },
    ...validateBody(
      bodySchemas.setupStart,
      false,
      (c) => c.env.KOMO_HOSTED === "true",
    ),
    async (c, next) => {
      const request = c.req.raw,
        env = c.env,
        url = new URL(request.url);
      if (env.KOMO_HOSTED !== "true") return next();
      const config = workspaceConfig(c.req.valid("json"));
      const id = crypto.randomUUID(),
        secret = createSessionToken();
      await env.DB.operations
        .insertSetupRequest({
          id: id,
          poll_hash: await digest(secret),
          config: JSON.stringify(config),
          expires_at: Date.now() + 600000,
        })
        .execute();
      return c.json({ id, secret, url: `${url.origin}/setup?code=${id}` });
    },
  )
  .post(
    "/setup/poll",
    async (c, next) => {
      const request = c.req.raw,
        env = c.env;
      if (env.KOMO_HOSTED !== "true") return next();
      await enforceRequestLimit(
        env,
        `poll:${request.headers.get("CF-Connecting-IP") ?? "local"}`,
        30,
      );
      await next();
    },
    ...validateBody(
      bodySchemas.setupPoll,
      false,
      (c) => c.env.KOMO_HOSTED === "true",
    ),
    async (c, next) => {
      const request = c.req.raw,
        env = c.env,
        url = new URL(request.url);
      if (env.KOMO_HOSTED !== "true") return next();
      const data = c.req.valid("json");
      const row = await env.DB.operations
        .pollSetup(
          string(data.id, 100, "setup ID"),
          await digest(string(data.secret, 200, "setup secret")),
          Date.now(),
        )
        .first();
      if (!row) throw new HttpError(404, "Setup expired. Run komo init again.");
      return c.json(
        row.project
          ? {
              project: row.project,
              repo: JSON.parse(row.config).repo,
              endpoint: url.origin,
            }
          : { pending: true },
      );
    },
  )
  .all("/auth/github/authorize", (c) =>
    oauthAuthorize(c.req.raw, c.env, "github"),
  )
  .all("/auth/github/callback", (c) =>
    oauthCallback(c.req.raw, c.env, "github"),
  )
  .all("/auth/google/authorize", (c) =>
    oauthAuthorize(c.req.raw, c.env, "google"),
  )
  .all("/auth/google/callback", (c) =>
    oauthCallback(c.req.raw, c.env, "google"),
  );
