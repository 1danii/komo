import type { Identity } from "../src/types";
import type { KomoBackendEnv } from "./database-adapter";
import { HttpError } from "./validation";
export async function privateAccess(env: KomoBackendEnv, project: string) {
  return (
    (await env.DB.operations.projectAccess(project).first())?.access ===
    "private"
  );
}
export async function requireMember(
  env: KomoBackendEnv,
  project: string,
  user: Identity,
) {
  if (!(user.verified && user.id.startsWith("google:")))
    throw new HttpError(403, "Sign in with your invited Google account.");
  const access = await env.DB.operations.memberAccess(project, user.id).first();
  if (!access)
    throw new HttpError(
      403,
      "This project is invite-only. Ask its owner for an invitation.",
    );
}
