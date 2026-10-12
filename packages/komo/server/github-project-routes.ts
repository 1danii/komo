import { createFactory } from "hono/factory";
import { sql } from "drizzle-orm";
import type { KomoBackendEnv } from "./database-adapter";
import type { AuthenticatedProjectEnv } from "./komo-context";
import {
  githubAppConfigured,
  githubAppRead,
  githubInstallationRepositories,
  githubInstallationToken,
  requireGithubApp,
  type GithubInstallation,
} from "./github-app-client";
import { startGithubConnection } from "./github-connect-routes";
import { bodySchemas, validateBody } from "./request-validation";
import { HttpError } from "./validation";

type GithubProjectEnv = AuthenticatedProjectEnv & {
  Variables: { managedProject: string };
};
type ProjectGithub = {
  login: string;
  installations: string;
  installation_id: string | null;
  repository_id: string | null;
  repository_name: string | null;
};

const projectGithub = (env: KomoBackendEnv, project: string) =>
  env.DB.raw<ProjectGithub>(
    sql`SELECT login,installations,installation_id,repository_id,repository_name FROM project_github WHERE project=${project}`,
  ).first();

/** These routes mount after project authentication and Google-owner authorization. */
export const githubProjectRoutes = createFactory<GithubProjectEnv>()
  .createApp()
  .get("/", async (c) => {
    const configured = githubAppConfigured(c.env);
    const row = configured
      ? await projectGithub(c.env, c.var.managedProject)
      : null;
    if (!row)
      return c.json({
        configured,
        connection: null,
        repository: null,
        repositories: [],
      });
    // Repository choices come from the App's installation tokens; no user token is stored.
    const installations = JSON.parse(row.installations) as GithubInstallation[];
    const lists = await Promise.allSettled(
      installations.map((item) =>
        githubInstallationRepositories(c.env, item.id),
      ),
    );
    const failures = lists.flatMap((item) =>
      item.status === "rejected" ? [item.reason] : [],
    );
    const unexpected = failures.find((error) => !(error instanceof HttpError));
    if (unexpected) throw unexpected;
    // Without webhooks, an uninstall is noticed here and removed like GitHub's installation.deleted.
    const removed = new Set(
      installations
        .filter(
          (_, index) =>
            (lists[index] as PromiseRejectedResult).reason?.code ===
            "github_uninstalled",
        )
        .map((item) => item.id),
    );
    let repository = row.repository_id
      ? { id: row.repository_id, name: row.repository_name! }
      : null;
    if (removed.size) {
      const remaining = installations.filter((item) => !removed.has(item.id));
      const clearRepository = removed.has(row.installation_id ?? "");
      // Compare the stored list so a concurrent reconnection is never overwritten.
      await c.env.DB.raw(
        remaining.length
          ? sql`UPDATE project_github SET installations=${JSON.stringify(remaining)}
            ${clearRepository ? sql`,installation_id=NULL,repository_id=NULL,repository_name=NULL` : sql``}
            WHERE project=${c.var.managedProject} AND installations=${row.installations}`
          : sql`DELETE FROM project_github WHERE project=${c.var.managedProject} AND installations=${row.installations}`,
      ).execute();
      if (!remaining.length)
        return c.json({
          configured,
          connection: null,
          repository: null,
          repositories: [],
          removed: true,
        });
      if (clearRepository) repository = null;
    }
    const repositories = lists
      .flatMap((item) => (item.status === "fulfilled" ? item.value : []))
      .sort((a, b) => a.name.localeCompare(b.name));
    const failure = failures.find(
      (error) => (error as HttpError).code !== "github_uninstalled",
    ) as HttpError | undefined;
    return c.json({
      configured,
      connection: { login: row.login },
      repository,
      repositories,
      removed: removed.size > 0,
      available:
        !repository || repositories.some((item) => item.id === repository.id),
      ...(failure && !repositories.length ? { error: failure.message } : {}),
    });
  })
  .post("/connect", ...validateBody(bodySchemas.githubConnect), async (c) =>
    c.json(
      await startGithubConnection(
        c.env,
        c.req.raw,
        c.var.user.id,
        c.var.managedProject,
        c.var.project,
        !!c.req.valid("json").install,
      ),
    ),
  )
  .patch("/", ...validateBody(bodySchemas.githubProject), async (c) => {
    requireGithubApp(c.env);
    const { repositoryId } = c.req.valid("json");
    const project = c.var.managedProject;
    const row = await projectGithub(c.env, project);
    if (!row) throw new HttpError(409, "Connect GitHub first.");
    // A repository-scoped issue token proves both installation access and the Issues permission.
    for (const { id } of JSON.parse(row.installations) as GithubInstallation[]) {
      let token: string;
      try {
        token = await githubInstallationToken(c.env, id, repositoryId);
      } catch (error) {
        if (
          error instanceof HttpError &&
          ["github_access", "github_uninstalled"].includes(error.code ?? "")
        )
          continue;
        throw error;
      }
      const repository = await githubAppRead<{
        id: number;
        full_name: string;
        archived: boolean;
        has_issues: boolean;
      }>(token, `/repositories/${repositoryId}`);
      if (
        String(repository.id) !== repositoryId ||
        repository.archived ||
        !repository.has_issues
      )
        throw new HttpError(409, "This repository cannot accept issues.");
      await c.env.DB.raw(
        sql`UPDATE project_github SET installation_id=${id},repository_id=${repositoryId},repository_name=${repository.full_name} WHERE project=${project}`,
      ).execute();
      return c.json({ ok: true });
    }
    throw new HttpError(
      403,
      "This repository is not available to your GitHub installation.",
    );
  })
  .delete("/", async (c) => {
    const project = c.var.managedProject;
    await c.env.DB.batch([
      c.env.DB.raw(
        sql`DELETE FROM github_connect_states WHERE project=${project}`,
      ),
      c.env.DB.raw(sql`DELETE FROM project_github WHERE project=${project}`),
    ]);
    return c.json({ ok: true });
  });
