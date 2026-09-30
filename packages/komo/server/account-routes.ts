import { createMiddleware } from "hono/factory";
import {
  authenticateSession,
  createSessionToken,
  createUserSession,
} from "./auth-sessions";
import { digest } from "./digest";
import { projectFactory, type AuthenticatedProjectEnv } from "./komo-context";
import { privateAccess } from "./project-management";
import { enforceRequestLimit } from "./request-limits";
import { bodySchemas, validateBody } from "./request-validation";
import { cliReturnOrigin, HttpError } from "./validation";
const oauthStartRoutes = projectFactory.createApp().post(
  "/",
  async (c, next) => {
    const request = c.req.raw,
      env = c.env,
      url = new URL(request.url);
    const { project, ip } = c.var;
    const provider = url.pathname.includes("/google/") ? "google" : "github";
    if (
      !(provider === "google"
        ? env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
        : env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET)
    )
      throw new HttpError(503, "Sign-in is not configured.");
    await enforceRequestLimit(env, `${project}:oauth:${ip}`, 20, 3600);
    await next();
  },
  ...validateBody(bodySchemas.oauthStart, true),
  async (c) => {
    const request = c.req.raw,
      env = c.env,
      url = new URL(request.url);
    const { project, origin } = c.var;
    const provider = url.pathname.includes("/google/") ? "google" : "github";

    const data = c.req.valid("json");
    const returnOrigin = cliReturnOrigin(data.returnOrigin, origin);
    const state = createSessionToken();
    const verifier = createSessionToken();
    const exchange = createSessionToken();
    await env.DB.operations
      .insertOAuthState({
        state_hash: await digest(state),
        verifier: verifier,
        project: project,
        origin: returnOrigin,
        expires_at: Date.now() + 600000,
        exchange_hash: await digest(exchange),
        provider: provider,
      })
      .execute();
    return c.json({
      url: `${url.origin}/auth/${provider}/authorize?state=${encodeURIComponent(state)}`,
    });
  },
);
/** Account routes run after project policy, before thread visibility checks. */
export const accountRoutes = projectFactory
  .createApp()
  .post(
    "/auth/guest",
    async (c, next) => {
      const env = c.env;
      const { project, config, ip } = c.var;
      if (!!(await privateAccess(env, project)))
        throw new HttpError(
          403,
          "This project requires an invited Google account.",
        );
      if (config.allowGuests === false)
        throw new HttpError(403, "Guest comments are disabled.");
      await enforceRequestLimit(env, `${project}:guest:${ip}`, 20, 3600);
      await next();
    },
    ...validateBody(bodySchemas.guest),
    async (c) => {
      const env = c.env;
      const { project } = c.var;

      const data = c.req.valid("json");
      const name = data.name;
      const id = `guest:${crypto.randomUUID()}`;
      await env.DB.operations.insertUser({ id: id, name: name }).execute();
      return c.json(
        {
          token: await createUserSession(env, project, id),
          user: { id, name, verified: false },
        },
        201,
      );
    },
  )
  .route("/auth/github/start", oauthStartRoutes)
  .route("/auth/google/start", oauthStartRoutes)
  .use(
    "/me",
    createMiddleware<AuthenticatedProjectEnv>(async (c, next) => {
      c.set("user", await authenticateSession(c.req.raw, c.env, c.var.project));
      await next();
    }),
  )
  .delete("/me", async (c) => {
    const request = c.req.raw,
      env = c.env;

    const bearer = request.headers.get("Authorization")!.slice(7);
    await env.DB.operations.deleteSession(await digest(bearer)).execute();
    return c.json({ ok: true });
  })
  .patch("/me", ...validateBody(bodySchemas.profile), async (c) => {
    const env = c.env;
    const { user } = c.var;

    const data = c.req.valid("json");
    const name = data.name;
    const accentColor = data.accentColor ?? user.accentColor;
    if (
      !(
        accentColor === undefined ||
        (typeof accentColor === "string" && /^#[0-9a-f]{6}$/i.test(accentColor))
      )
    )
      throw new HttpError(400, "Choose a valid accent color.");
    const normalizedAccent = accentColor?.toLowerCase();
    const avatarUrl = data.avatarUrl.trim();
    const uploadedPhoto = /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(
      avatarUrl,
    );
    if (avatarUrl && !uploadedPhoto) {
      if (!(avatarUrl.length <= 2048))
        throw new HttpError(400, "Photo URL is too long.");
      let photo: URL;
      try {
        photo = new URL(avatarUrl);
      } catch {
        throw new HttpError(400, "Use an HTTPS photo URL.");
      }
      if (!(photo.protocol === "https:" && !photo.username && !photo.password))
        throw new HttpError(400, "Use an HTTPS photo URL.");
    }
    await env.DB.operations
      .updateUser(user.id, {
        name: name,
        avatar_url: avatarUrl,
        accent_color: normalizedAccent ?? null,
      })
      .execute();
    return c.json({
      user: {
        ...user,
        name,
        avatarUrl: avatarUrl || undefined,
        accentColor: normalizedAccent,
      },
    });
  })
  .get("/me", (c) => c.json({ user: c.var.user }))
  .all("/me", () => {
    throw new HttpError(405, "Method not allowed.");
  });
