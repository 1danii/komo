import { createPrivateKey, sign } from "node:crypto";
import type { KomoBackendEnv } from "./database-adapter";
import { HttpError } from "./validation";

/** Only the GitHub App credentials configure this integration, not GitHub sign-in. */
export function githubAppConfigured(env: KomoBackendEnv) {
  return !!(
    /^[1-9][0-9]*$/.test(env.GITHUB_APP_ID ?? "") &&
    /^[a-z0-9-]+$/.test(env.GITHUB_APP_SLUG ?? "") &&
    env.GITHUB_APP_CLIENT_ID &&
    env.GITHUB_APP_CLIENT_SECRET &&
    env.GITHUB_APP_PRIVATE_KEY
  );
}

/** Fail closed when a deployment has not configured a GitHub App. */
export function requireGithubApp(env: KomoBackendEnv) {
  if (!githubAppConfigured(env))
    throw new HttpError(503, "GitHub App is not configured on this server.");
}

/** Exchange a one-time authorization code; the user token is used only to verify installation access. */
export async function githubTokenExchange(
  env: KomoBackendEnv,
  fields: Record<string, string>,
) {
  requireGithubApp(env);
  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    redirect: "manual",
    signal: AbortSignal.timeout(15000),
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      client_id: env.GITHUB_APP_CLIENT_ID!,
      client_secret: env.GITHUB_APP_CLIENT_SECRET!,
      ...fields,
    }),
  });
  if (response.status >= 300 && response.status < 400)
    throw new HttpError(
      502,
      "GitHub returned an unexpected redirect. Try again.",
    );
  if (response.status === 429 || response.status >= 500)
    throw new HttpError(502, "GitHub is unavailable. Try again.");
  const result = await response
    .json<{
      access_token?: string;
      error?: string;
    }>()
    .catch(() => {
      throw new HttpError(502, "Invalid GitHub response. Try again.");
    });
  if (
    result.error === "server_error" ||
    result.error === "temporarily_unavailable"
  )
    throw new HttpError(502, "GitHub is unavailable. Try again.");
  if (!response.ok || !result.access_token || result.error)
    throw new HttpError(400, "GitHub authorization failed. Try again.");
  return result.access_token;
}

/** Read GitHub App resources; this client deliberately exposes no issue writes. */
export async function githubAppRead<T>(
  token: string,
  path: string,
): Promise<T> {
  const response = await fetch(`https://api.github.com${path}`, {
    redirect: "manual",
    signal: AbortSignal.timeout(15000),
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "komo",
    },
  });
  if (response.status >= 300 && response.status < 400)
    throw new HttpError(
      502,
      "GitHub returned an unexpected redirect. Try again.",
    );
  if ([401, 403, 404].includes(response.status))
    throw new HttpError(
      409,
      "GitHub access is unavailable. Check app permissions and try again.",
      "github_access",
    );
  if (!response.ok)
    throw new HttpError(502, "GitHub is unavailable. Try again.");
  return response.json<T>();
}

/** Paginate by bounded page numbers, never follow an untrusted next-page URL. */
export async function githubAppPages<T>(
  token: string,
  path: string,
  field: string,
) {
  const items: T[] = [];
  for (let page = 1; page <= 100; page++) {
    const result = await githubAppRead<Record<string, unknown>>(
      token,
      `${path}?per_page=100&page=${page}`,
    );
    const rows = result[field];
    if (!Array.isArray(rows))
      throw new HttpError(502, "Invalid GitHub response.");
    items.push(...(rows as T[]));
    if (
      rows.length < 100 ||
      (typeof result.total_count === "number" &&
        items.length >= result.total_count)
    )
      return items;
  }
  throw new HttpError(
    409,
    "Too many GitHub repositories. Limit this app to selected repositories.",
  );
}

/** Request a short-lived installation token signed with the App key; GitHub's PKCS#1 and PKCS#8 keys work. */
export async function githubInstallationToken(
  env: KomoBackendEnv,
  installation: string,
  repository?: string,
) {
  requireGithubApp(env);
  const now = Math.floor(Date.now() / 1000);
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  const payload = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({ iat: now - 60, exp: now + 540, iss: env.GITHUB_APP_ID })}`;
  let signature: string;
  try {
    signature = sign(
      "RSA-SHA256",
      Buffer.from(payload),
      createPrivateKey(env.GITHUB_APP_PRIVATE_KEY!.replace(/\\n/g, "\n")),
    ).toString("base64url");
  } catch {
    throw new HttpError(503, "The GitHub App private key is invalid.");
  }
  // Issue tokens are scoped to one repository; listing tokens only read metadata.
  const response = await fetch(
    `https://api.github.com/app/installations/${encodeURIComponent(installation)}/access_tokens`,
    {
      method: "POST",
      redirect: "manual",
      signal: AbortSignal.timeout(15000),
      headers: {
        Authorization: `Bearer ${payload}.${signature}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "komo",
      },
      body: JSON.stringify(
        repository
          ? {
              repository_ids: [Number(repository)],
              permissions: { issues: "write" },
            }
          : { permissions: { metadata: "read" } },
      ),
    },
  );
  // Verified against GitHub: 404 only means this App's installation is gone; a wrong key or App ID is 401.
  if (response.status === 404)
    throw new HttpError(409, "GitHub access was removed.", "github_uninstalled");
  if (response.status === 401)
    throw new HttpError(503, "The GitHub App credentials are invalid.");
  // 422 covers repositories outside the installation and permissions it has not accepted.
  if (response.status === 422)
    throw new HttpError(
      409,
      "This repository is not available to the GitHub App, or its Issues permission was not accepted.",
      "github_access",
    );
  if (response.status === 403)
    throw new HttpError(
      409,
      "This GitHub installation is suspended.",
      "github_access",
    );
  if (!response.ok)
    throw new HttpError(502, "GitHub is unavailable. Try again.");
  const result = await response.json<{ token?: string }>();
  if (!result.token)
    throw new HttpError(502, "Invalid GitHub installation response.");
  return result.token;
}

export type GithubInstallation = { id: string; account: string };
export type GithubRepository = { id: string; name: string };

/** Only active installations of this App that GitHub grants to the authorizing user. */
export async function githubUserInstallations(
  env: KomoBackendEnv,
  userToken: string,
): Promise<GithubInstallation[]> {
  return (
    await githubAppPages<{
      id: number;
      app_id: number;
      suspended_at: string | null;
      account: { login: string };
    }>(userToken, "/user/installations", "installations")
  )
    .filter(
      (item) => String(item.app_id) === env.GITHUB_APP_ID && !item.suspended_at,
    )
    .map((item) => ({ id: String(item.id), account: item.account.login }));
}

/** Unarchived repositories granted to one installation, keyed by stable repository ID. */
export async function githubInstallationRepositories(
  env: KomoBackendEnv,
  installation: string,
): Promise<GithubRepository[]> {
  const token = await githubInstallationToken(env, installation);
  return (
    await githubAppPages<{ id: number; full_name: string; archived: boolean }>(
      token,
      "/installation/repositories",
      "repositories",
    )
  )
    .filter((item) => !item.archived)
    .map((item) => ({ id: String(item.id), name: item.full_name }));
}
