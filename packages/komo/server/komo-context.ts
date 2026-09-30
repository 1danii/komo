import type { Context } from "hono";
import { createFactory } from "hono/factory";
import type { Identity } from "../src/types";
import type { KomoBackendEnv } from "./database-adapter";
import type { Project } from "./workspaces";

/** Public routes have backend bindings, but no middleware-populated variables. */
export type KomoHttpEnv = { Bindings: KomoBackendEnv; Variables: {} };

/** Project route groups require resolveProject to run before they are mounted. */
export type ProjectHttpEnv = KomoHttpEnv & {
  Variables: {
    project: string;
    config: Project;
    origin: string;
    ip: string;
    owner: { user_id: string } | null;
  };
};

/** Authentication middleware adds an identity to an already-resolved project. */
export type AuthenticatedProjectEnv = ProjectHttpEnv & {
  Variables: { user: Identity };
};

/** Shared factory for public routes and middleware that only need backend bindings. */
export const komoFactory = createFactory<KomoHttpEnv>();

/** Project routes share a mount prerequisite, not authenticated or loaded-record state. */
export const projectFactory = createFactory<ProjectHttpEnv>();

/** Conditional validation uses only the project state established before its route group. */
export type ProjectContext = Context<ProjectHttpEnv>;
