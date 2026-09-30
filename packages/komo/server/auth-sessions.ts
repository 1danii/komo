import { sql } from "drizzle-orm";
import type { Identity } from "../src/types.js";
import type { KomoBackendEnv } from "./database-adapter";
import { digest } from "./digest";
import { HttpError } from "./validation";
/** Stored identity fields keep integer verification flags at the database boundary. */
export type UserRow = {
  id: string;
  name: string;
  verified: number;
  avatar_url?: string | null;
  accent_color?: string | null;
};
/** Convert a stored identity to the existing browser and CLI response shape. */
export const sessionIdentity = (row: UserRow): Identity => ({
  id: row.id,
  name: row.name,
  verified: !!row.verified,
  avatarUrl: row.avatar_url || undefined,
  accentColor: row.accent_color || undefined,
});
/** Generate an opaque token for sessions and one-use OAuth handoffs. */
export const createSessionToken = () =>
  crypto.randomUUID() + crypto.randomUUID();
// Sessions should not force reviewers back through sign-in:
// keep them valid for a century and only revoke on logout.
const SESSION_LIFETIME = 100 * 365 * 86400000;
/** Create a project-scoped session without granting membership to uninvited users. */
export async function createUserSession(
  env: KomoBackendEnv,
  project: string,
  userId: string,
) {
  const accessToken = createSessionToken();
  await env.DB.batch([
    env.DB.raw(
      sql`INSERT INTO project_members(project,user_id) SELECT ${project},${userId} WHERE NOT EXISTS(SELECT 1 FROM project_settings WHERE project=${project} AND access='private') OR EXISTS(SELECT 1 FROM project_owners WHERE project=${project} AND user_id=${userId}) OR EXISTS(SELECT 1 FROM project_access WHERE project=${project} AND user_id=${userId}) ON CONFLICT DO NOTHING`,
    ),
    env.DB.operations.insertSession({
      token_hash: await digest(accessToken),
      user_id: userId,
      project: project,
      expires_at: Date.now() + SESSION_LIFETIME,
    }),
  ]);
  return accessToken;
}
/** Authenticate only live sessions belonging to the requested project. */
export async function authenticateSession(
  request: Request,
  env: KomoBackendEnv,
  project: string,
): Promise<Identity> {
  const bearer = request.headers
    .get("Authorization")
    ?.match(/^Bearer (.{1,200})$/)?.[1];
  if (!bearer) throw new HttpError(401, "Enter your name to comment.");
  const row = await env.DB.operations
    .sessionUser(await digest(bearer), project, Date.now())
    .first();
  if (!row)
    throw new HttpError(401, "Your session expired. Enter your name again.");
  return sessionIdentity(row);
}
