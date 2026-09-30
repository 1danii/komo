import { backendEnvironment } from "./d1-adapter";
import type { KomoBackendEnv } from "./database-adapter";
import { komoApp } from "./komo-app";
import { maintain } from "./workspaces";

export default {
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(maintain(backendEnvironment(env).DB, true));
  },
  fetch(
    request: Request,
    bindings: Env | KomoBackendEnv,
    ctx: ExecutionContext,
  ) {
    return komoApp.fetch(request, backendEnvironment(bindings), ctx);
  },
} satisfies ExportedHandler<Env>;
