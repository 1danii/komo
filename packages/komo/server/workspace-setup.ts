import type { Identity } from "../src/types.js";
import type { KomoBackendEnv } from "./database-adapter";
import { originAllowed, previewPattern, HttpError } from "./validation";
import { provision } from "./workspaces";
/** Consume one-use setup claims, restoring retryable claims if provisioning fails. */
export async function completeSetup(
  env: KomoBackendEnv,
  user: Identity,
  code: string,
  origin?: string,
  sites: string[] = origin ? [origin] : [],
) {
  const setup = await env.DB.operations.consumeSetup(code, Date.now()).first();
  if (!setup)
    throw new HttpError(
      409,
      "Setup expired or already completed. Run komo init again.",
    );
  const config = JSON.parse(setup.config);
  let created: { project: string; repo: string };
  try {
    if (origin)
      if (!originAllowed(origin, config.origins))
        throw new HttpError(403, "Return to the site where you started setup.");
    created = await provision(env, user, config);
  } catch (error) {
    // A quota or validation error must not turn a retry into an expired request.
    await env.DB.operations
      .insertSetupRequest({
        id: code,
        poll_hash: setup.poll_hash,
        config: setup.config,
        expires_at: setup.expires_at,
      })
      .execute();
    throw error;
  }
  // The site setup ran on proves the deploy host, so its previews come too.
  const preview = origin && previewPattern(origin);
  const httpsSites = [
    ...new Set([...sites, ...(preview ? [preview] : [])]),
  ].filter((site) => site.startsWith("https://"));
  if (httpsSites.length) {
    await env.DB.batch(
      httpsSites.map((site) =>
        env.DB.operations.insertWorkspaceDomain({
          project: created.project,
          origin: site,
          verified_at: Date.now(),
        }),
      ),
    );
  }
  await env.DB.operations
    .insertSetupRequest({
      id: code,
      poll_hash: setup.poll_hash,
      config: setup.config,
      project: created.project,
      expires_at: setup.expires_at,
    })
    .execute();
  return created;
}
