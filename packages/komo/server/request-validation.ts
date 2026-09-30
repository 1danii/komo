import { zValidator, type Hook } from "@hono/zod-validator";
import type { Context, MiddlewareHandler } from "hono";
import { z } from "zod";
import "zod/compile";
import { isEmoji } from "../src/emoji";
import type { KomoHttpEnv } from "./komo-context";
import { anchorValue, HttpError, pagePath } from "./validation";
/** Bound the stream before Hono parses JSON; do not trust Content-Length alone. */
function boundedJsonBody<E extends KomoHttpEnv>(
  optional: boolean,
): MiddlewareHandler<E> {
  return async (c, next) => {
    const request = c.req.raw;
    if (optional && !request.body) {
      const headers = new Headers(request.headers);
      headers.set("Content-Type", "application/json");
      c.req.raw = new Request(request, { headers, body: "{}" });
    } else {
      if (
        request.headers.get("Content-Type")?.split(";")[0] !==
        "application/json"
      )
        throw new HttpError(415, "Use application/json.");
      const reader = request.body?.getReader();
      if (!reader) throw new HttpError(400, "Missing body.");
      let length = 0;
      const parts: Uint8Array[] = [];
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.length;
        if (length > 16384) {
          await reader.cancel();
          throw new HttpError(413, "Request too large.");
        }
        parts.push(value);
      }
      const bytes = new Uint8Array(length);
      let offset = 0;
      for (const part of parts) {
        bytes.set(part, offset);
        offset += part.length;
      }
      const headers = new Headers(request.headers);
      headers.set("Content-Type", "application/json");
      c.req.raw = new Request(request, { headers, body: bytes });
    }
    try {
      const value: unknown = await c.req.json();
      if (!(value && typeof value === "object" && !Array.isArray(value)))
        throw new HttpError(400, "Invalid JSON object.");
    } catch {
      throw new HttpError(400, "Invalid JSON object.");
    }
    await next();
  };
}
/** Preserve established domain errors while collecting ordered Zod issues. */
const normalized = <Value>(parse: (value: unknown) => Value) =>
  z.unknown().transform((value, ctx) => {
    try {
      return parse(value);
    } catch (error) {
      if (!(error instanceof HttpError)) throw error;
      ctx.addIssue({ code: "custom", message: error.message });
      return z.NEVER;
    }
  });
const deferred = z.unknown().optional();
const text = (max: number, label: string) =>
  z
    .string({ error: `Invalid ${label}.` })
    .max(max, { error: `Invalid ${label}.` })
    .trim()
    .min(1, { error: `Invalid ${label}.` });
const requestObject = <Shape extends z.ZodRawShape>(shape: Shape) =>
  // Unknown fields were rejected before individual values in the original API.
  z
    .strictObject(
      Object.fromEntries(Object.keys(shape).map((key) => [key, deferred])),
    )
    .pipe(z.object(shape));

/** Request schemas preserve existing normalization and defer permission-dependent checks. */
export const bodySchemas = {
  setupStart: requestObject({
    repo: text(200, "repository"),
    origins: deferred,
  }),
  setupPoll: requestObject({
    id: text(100, "setup ID"),
    secret: text(200, "setup secret"),
  }),
  setupComplete: requestObject({ code: text(100, "setup code") }),
  workspaceSite: requestObject({
    project: text(100, "project"),
    origin: deferred,
  }),
  ownerClaim: requestObject({ key: deferred }),
  guest: requestObject({ name: text(60, "name") }),
  oauthStart: requestObject({ returnOrigin: deferred }),
  profile: requestObject({
    name: text(60, "name"),
    avatarUrl: z
      .string({ error: "Invalid photo URL." })
      .max(12000, { error: "Invalid photo URL." }),
    accentColor: deferred,
  }),
  threadCreate: requestObject({
    body: text(4000, "comment"),
    page: normalized(pagePath),
    anchor: normalized(anchorValue),
  }),
  threadUpdate: requestObject({ anchor: deferred, resolved: deferred }),
  reply: requestObject({ body: text(4000, "reply") }),
  commentEdit: requestObject({ body: text(4000, "comment") }),
  reaction: requestObject({
    emoji: z.custom<string>(isEmoji, { error: "Invalid reaction." }),
    active: z.boolean({ error: "Invalid reaction." }),
  }),
  project: requestObject({
    access: deferred,
    confirm: deferred,
    threadIds: deferred,
  }),
  projectImport: requestObject({
    source: text(100, "source project"),
    kind: text(20, "table"),
    records: deferred,
  }),
  projectJoin: requestObject({ invite: deferred }),
  projectInvite: requestObject({ email: text(254, "email") }),
  projectMember: requestObject({ user: text(150, "member") }),
  projectSites: requestObject({ sites: deferred }),
};
/** Register once per route, after access checks, and consume c.req.valid("json"). */
export function validateBody<
  Schema extends z.ZodType<Record<string, unknown>>,
  E extends KomoHttpEnv = KomoHttpEnv,
>(
  schema: Schema,
  optional = false,
  when: (c: Context<E>) => boolean = () => true,
) {
  const bounded = boundedJsonBody<E>(optional);
  const hook: Hook<z.output<Schema>, E, string, "json", {}, Schema> = (
    result,
  ) => {
    if (!result.success) {
      const issue = result.error.issues[0];
      throw new HttpError(
        400,
        issue.code === "unrecognized_keys"
          ? "Invalid JSON object."
          : issue.message,
      );
    }
  };
  const validate = zValidator<Schema, "json", E, string, typeof hook>(
    "json",
    schema,
    hook,
  );
  const body: MiddlewareHandler<E> = (c, next) =>
    when(c) ? bounded(c, next) : next();
  const enabled: typeof validate = (c, next) =>
    when(c) ? validate(c, next) : next();
  return [body, enabled] as const;
}
