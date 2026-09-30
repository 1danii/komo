import { timingSafeEqual } from "node:crypto";
import { createUserSession, sessionIdentity } from "./auth-sessions";
import type { KomoBackendEnv } from "./database-adapter";
import { digest } from "./digest";
import { string, HttpError } from "./validation";
import { completeSetup } from "./workspace-setup";
/** Bind provider authorization to the saved one-use state and PKCE verifier. */
export async function oauthAuthorize(
  request: Request,
  env: KomoBackendEnv,
  provider: "github" | "google",
) {
  const url = new URL(request.url);
  const state = string(url.searchParams.get("state"), 200, "state");
  const saved = await env.DB.operations
    .oauthVerifier(await digest(state), provider, Date.now())
    .first();
  if (!saved)
    throw new HttpError(
      400,
      "Sign-in expired. Return to the site and try again.",
    );
  const challengeDigest = new Uint8Array(
    await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(saved.verifier),
    ),
  );
  const challenge = btoa(String.fromCharCode(...challengeDigest))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const authorize = new URL(
    provider === "google"
      ? "https://accounts.google.com/o/oauth2/v2/auth"
      : "https://github.com/login/oauth/authorize",
  );
  authorize.search = new URLSearchParams({
    client_id:
      provider === "google" ? env.GOOGLE_CLIENT_ID : env.GITHUB_CLIENT_ID,
    redirect_uri: `${url.origin}/auth/${provider}/callback`,
    ...(provider === "google"
      ? { response_type: "code", scope: "openid profile email" }
      : {}),
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  }).toString();
  return new Response(null, {
    status: 302,
    headers: {
      Location: authorize.href,
      "Set-Cookie": `__Host-comments-oauth=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`,
    },
  });
}
/** Exchange OAuth state only after verifying its browser cookie and provider. */
export async function oauthCallback(
  request: Request,
  env: KomoBackendEnv,
  provider: "github" | "google",
) {
  const url = new URL(request.url);
  const state = url.searchParams.get("state") ?? "";
  const code = url.searchParams.get("code");
  const cookie =
    request.headers
      .get("Cookie")
      ?.match(/(?:^|;\s*)__Host-comments-oauth=([^;]+)/)?.[1] ?? "";
  const encoder = new TextEncoder();
  if (
    !(
      state.length > 0 &&
      cookie.length === state.length &&
      timingSafeEqual(encoder.encode(state), encoder.encode(cookie))
    )
  )
    throw new HttpError(
      400,
      "Sign-in browser does not match. Return to the site and try again.",
    );
  const saved = await env.DB.operations
    .consumeOAuthState(await digest(state), provider, Date.now())
    .first();
  if (
    !(
      saved &&
      code &&
      (provider === "google"
        ? env.GOOGLE_CLIENT_SECRET
        : env.GITHUB_CLIENT_SECRET)
    )
  )
    throw new HttpError(
      400,
      "Sign-in expired or was cancelled. Close this window and try again.",
    );
  const response = await fetch(
    provider === "google"
      ? "https://oauth2.googleapis.com/token"
      : "https://github.com/login/oauth/access_token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        client_id:
          provider === "google" ? env.GOOGLE_CLIENT_ID : env.GITHUB_CLIENT_ID,
        client_secret:
          provider === "google"
            ? env.GOOGLE_CLIENT_SECRET
            : env.GITHUB_CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: `${url.origin}/auth/${provider}/callback`,
        code_verifier: saved.verifier,
      }),
    },
  );
  const result = await response.json<{ access_token?: string }>();
  if (!(response.ok && result.access_token))
    throw new HttpError(401, "Sign-in failed.");
  const profileResponse = await fetch(
    provider === "google"
      ? "https://openidconnect.googleapis.com/v1/userinfo"
      : "https://api.github.com/user",
    {
      headers: {
        Authorization: `Bearer ${result.access_token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "branch-comments",
      },
    },
  );
  if (!profileResponse.ok)
    throw new HttpError(401, "Could not verify identity.");
  const profile = await profileResponse.json<{
    sub?: string;
    picture?: string;
    avatar_url?: string;
    accent_color?: string;
    id: number;
    login: string;
    name: string | null;
    email?: string;
    email_verified?: boolean;
  }>();
  if (
    !(provider === "google"
      ? typeof profile.sub === "string" && !!profile.sub && !!profile.name
      : Number.isInteger(profile.id) && !!profile.login)
  )
    throw new HttpError(401, "Invalid identity.");
  const id = `${provider}:${provider === "google" ? profile.sub : profile.id}`;
  const avatarUrl = profile.picture || profile.avatar_url || "";
  const safeAvatar = /^https:\/\//.test(avatarUrl) ? avatarUrl : "";
  await env.DB.operations
    .insertUser(
      {
        id: id,
        name: (profile.name || profile.login).slice(0, 60),
        verified: 1,
        avatar_url: safeAvatar,
      },
      true,
    )
    .execute();
  if (
    provider === "google" &&
    profile.email_verified === true &&
    typeof profile.email === "string"
  )
    await env.DB.operations
      .updateUser(id, { email: profile.email.toLowerCase() })
      .execute();
  const user = sessionIdentity((await env.DB.operations.userById(id).first())!);
  const setupCode =
    env.KOMO_HOSTED === "true" &&
    saved.approved_origins &&
    saved.project.startsWith("setup:")
      ? saved.project.slice(6)
      : undefined;
  if (setupCode && provider !== "google")
    throw new HttpError(403, "Use Google to connect komo.");
  const created = setupCode
    ? await completeSetup(
        env,
        user,
        setupCode,
        saved.origin,
        saved.approved_origins
          ? JSON.parse(saved.approved_origins)
          : [saved.origin],
      )
    : undefined;
  const accessToken = await createUserSession(
    env,
    created?.project ?? saved.project,
    id,
  );
  const nonce = crypto.randomUUID();
  const message = JSON.stringify({
    type: created ? "komo:setup" : "branch-comments:auth",
    ...(created ? { ...created, code: setupCode } : {}),
    token: accessToken,
    user,
  }).replace(/</g, "\\u003c");
  const target = JSON.stringify(saved.origin).replace(/</g, "\\u003c");
  return new Response(
    `<!doctype html><meta charset="utf-8"><title>Signed in</title><p>You’re signed in. You can close this window and return to your comments.</p><script nonce="${nonce}">if(window.opener){window.opener.postMessage(${message},${target});window.close();}</script>`,
    {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Security-Policy": `default-src 'none'; script-src 'nonce-${nonce}'; frame-ancestors 'none'`,
        "Cache-Control": "no-store",
        "Set-Cookie":
          "__Host-comments-oauth=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0",
      },
    },
  );
}
