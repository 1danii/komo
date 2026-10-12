import { timingSafeEqual } from "node:crypto";
import { sql } from "drizzle-orm";
import { createSessionToken } from "./auth-sessions";
import type { KomoBackendEnv } from "./database-adapter";
import { digest } from "./digest";
import {
  githubAppRead,
  githubTokenExchange,
  githubUserInstallations,
  requireGithubApp,
} from "./github-app-client";
import { komoFactory } from "./komo-context";
import { HttpError, string } from "./validation";

type ConnectState = {
  state_hash: string;
  owner_id: string;
  project: string;
  session_project: string;
  session_hash: string;
  origin: string;
  verifier: string;
  expires_at: number;
};
const cookieName = "__Host-komo-github-app";

/** Start a short-lived GitHub connection bound to the current project owner's session. */
export async function startGithubConnection(
  env: KomoBackendEnv,
  request: Request,
  owner: string,
  project: string,
  sessionProject: string,
  install: boolean,
) {
  requireGithubApp(env);
  const state = createSessionToken();
  const origin = request.headers.get("Origin") ?? new URL(request.url).origin;
  const bearer = request.headers.get("Authorization")!.slice(7);
  await env.DB.batch([
    env.DB.raw(
      sql`DELETE FROM github_connect_states WHERE expires_at<${Date.now()} OR (owner_id=${owner} AND project=${project})`,
    ),
    env.DB
      .raw(sql`INSERT INTO github_connect_states(state_hash,owner_id,project,session_project,session_hash,origin,verifier,expires_at)
      VALUES(${await digest(state)},${owner},${project},${sessionProject},${await digest(bearer)},${origin},${createSessionToken()},${Date.now() + 600000})`),
  ]);
  return {
    url: `${new URL(request.url).origin}/auth/github-app/authorize?state=${encodeURIComponent(state)}${install ? "&install=1" : ""}`,
  };
}

async function readConnectState(env: KomoBackendEnv, state: string) {
  const saved = await env.DB.raw<ConnectState>(
    sql`SELECT g.* FROM github_connect_states g
    JOIN sessions s ON s.token_hash=g.session_hash AND s.user_id=g.owner_id AND s.project=g.session_project
    JOIN project_owners p ON p.project=g.project AND p.user_id=g.owner_id
    WHERE g.state_hash=${await digest(state)} AND g.expires_at>${Date.now()} AND s.expires_at>${Date.now()}`,
  ).first();
  if (!saved)
    throw new HttpError(
      400,
      "GitHub connection expired. Close this window and try again.",
    );
  return saved;
}

const stateCookie = (request: Request) =>
  request.headers
    .get("Cookie")
    ?.match(/(?:^|;\s*)__Host-komo-github-app=([^;]+)/)?.[1] ?? "";

function redirect(location: string, cookie?: string) {
  return new Response(null, {
    status: 302,
    headers: {
      Location: location,
      ...(cookie ? { "Set-Cookie": cookie } : {}),
    },
  });
}

/** Installing grants repository access; GitHub returns through the App's setup URL. */
const installUrl = (env: KomoBackendEnv, state: string) =>
  `https://github.com/apps/${encodeURIComponent(env.GITHUB_APP_SLUG!)}/installations/new?state=${encodeURIComponent(state)}`;

/** User authorization proves which installations this person may use; it is silent once granted. */
async function oauthUrl(
  env: KomoBackendEnv,
  request: Request,
  state: string,
  verifier: string,
) {
  const challenge = btoa(
    String.fromCharCode(
      ...new Uint8Array(
        await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)),
      ),
    ),
  )
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const authorize = new URL("https://github.com/login/oauth/authorize");
  authorize.search = new URLSearchParams({
    client_id: env.GITHUB_APP_CLIENT_ID!,
    redirect_uri: `${new URL(request.url).origin}/auth/github-app/callback`,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  }).toString();
  return authorize.href;
}

/** OAuth callbacks report only completion, never GitHub or komo credentials, to the opener. */
function connectionComplete(origin: string | null, error?: string) {
  const nonce = crypto.randomUUID();
  const message = JSON.stringify({
    type: "komo:github-connected",
    error,
  }).replace(/</g, "\\u003c");
  const script = origin
    ? `<script nonce="${nonce}">if(window.opener){window.opener.postMessage(${message},${JSON.stringify(origin).replace(/</g, "\\u003c")});window.close();}</script>`
    : "";
  return new Response(
    `<!doctype html><meta charset="utf-8"><title>komo GitHub connection</title><p>Return to komo to continue.</p>${script}`,
    {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "Content-Security-Policy": `default-src 'none'; script-src 'nonce-${nonce}'; frame-ancestors 'none'`,
        "Set-Cookie": `${cookieName}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`,
      },
    },
  );
}

/** Browser-bound authorization is separate from GitHub sign-in and never trusts installation query parameters. */
export const githubConnectRoutes = komoFactory
  .createApp()
  .get("/auth/github-app/authorize", async (c) => {
    requireGithubApp(c.env);
    const state = string(c.req.query("state"), 200, "state");
    const saved = await readConnectState(c.env, state);
    const cookie = `${cookieName}=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`;
    if (c.req.query("install")) return redirect(installUrl(c.env, state), cookie);
    return redirect(await oauthUrl(c.env, c.req.raw, state, saved.verifier), cookie);
  })
  .get("/auth/github-app/setup", async (c) => {
    // GitHub's installation_id is untrusted; authorize again to list verified installations.
    requireGithubApp(c.env);
    const state = stateCookie(c.req.raw);
    if (!state) return connectionComplete(null);
    try {
      const saved = await readConnectState(c.env, state);
      return redirect(await oauthUrl(c.env, c.req.raw, state, saved.verifier));
    } catch {
      return connectionComplete(null);
    }
  })
  .get("/auth/github-app/callback", async (c) => {
    requireGithubApp(c.env);
    const state = string(c.req.query("state"), 200, "state");
    const cookie = stateCookie(c.req.raw);
    const encoder = new TextEncoder();
    if (
      !cookie ||
      encoder.encode(cookie).length !== encoder.encode(state).length ||
      !timingSafeEqual(encoder.encode(cookie), encoder.encode(state))
    )
      throw new HttpError(
        400,
        "GitHub connection browser does not match. Try again.",
      );
    const saved = await readConnectState(c.env, state);
    try {
      if (c.req.query("error"))
        throw new HttpError(400, "GitHub connection was cancelled.");
      const token = await githubTokenExchange(c.env, {
        code: string(c.req.query("code"), 500, "authorization code"),
        code_verifier: saved.verifier,
        redirect_uri: `${new URL(c.req.url).origin}/auth/github-app/callback`,
      });
      const user = await githubAppRead<{ login: string }>(token, "/user");
      if (!user.login) throw new HttpError(502, "Invalid GitHub identity.");
      const installations = await githubUserInstallations(c.env, token);
      // Without an installation, continue to GitHub's install page; setup returns here.
      if (!installations.length) return redirect(installUrl(c.env, state));
      const current = await c.env.DB.raw<{ installation_id: string | null }>(
        sql`SELECT installation_id FROM project_github WHERE project=${saved.project}`,
      ).first();
      // A selection survives reconnection only while this person can still use its installation.
      const keep = installations.some(
        (item) => item.id === current?.installation_id,
      );
      const result = await c.env.DB.batch([
        c.env.DB
          .raw(sql`INSERT INTO project_github(project,owner_id,login,installations)
          SELECT ${saved.project},${saved.owner_id},${user.login},${JSON.stringify(installations)}
          WHERE EXISTS(SELECT 1 FROM github_connect_states WHERE state_hash=${saved.state_hash} AND expires_at>${Date.now()})
          AND EXISTS(SELECT 1 FROM sessions WHERE token_hash=${saved.session_hash} AND user_id=${saved.owner_id} AND expires_at>${Date.now()})
          AND EXISTS(SELECT 1 FROM project_owners WHERE project=${saved.project} AND user_id=${saved.owner_id})
          ON CONFLICT(project) DO UPDATE SET owner_id=excluded.owner_id,login=excluded.login,installations=excluded.installations
          ${keep ? sql`` : sql`,installation_id=NULL,repository_id=NULL,repository_name=NULL`} RETURNING project`),
        c.env.DB.raw(
          sql`DELETE FROM github_connect_states WHERE state_hash=${saved.state_hash}`,
        ),
      ]);
      if (!result[0].results.length)
        throw new HttpError(409, "GitHub connection changed. Try again.");
      return connectionComplete(saved.origin);
    } catch (error) {
      await c.env.DB.raw(
        sql`DELETE FROM github_connect_states WHERE state_hash=${saved.state_hash}`,
      ).execute();
      return connectionComplete(
        saved.origin,
        error instanceof HttpError
          ? error.message
          : "GitHub connection failed. Try again.",
      );
    }
  });
