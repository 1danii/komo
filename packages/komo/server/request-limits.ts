import type { KomoBackendEnv } from "./database-adapter";
import { HttpError } from "./validation";
/** Charge the current rate limit bucket before checking its exact shared budget. */
export async function enforceRequestLimit(
  env: KomoBackendEnv,
  key: string,
  max: number,
  seconds = 60,
) {
  const now = Date.now();
  const bucket = Math.floor(now / (seconds * 1000));
  const row = await env.DB.operations
    .incrementRateLimit(`${key}:${bucket}`, now + seconds * 2000)
    .first();
  if (!(row && row.count <= max))
    throw new HttpError(429, "Too many requests. Try again shortly.");
}
