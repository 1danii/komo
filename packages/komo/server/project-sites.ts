import type { KomoBackendEnv } from "./database-adapter";
import { originAllowed, sitePattern, HttpError } from "./validation";
import type { Project } from "./workspaces";

const MAX_SITES = 10;

type SiteRow = { origin: string; removed?: number };

/** Owner edits to a configured project's sites, oldest schema first. */
export async function siteEdits(env: KomoBackendEnv, project: string) {
  // Only missing migration schema permits fallback. Operational errors must
  // never restore configured origins that the owner has revoked.
  const missing = (error: unknown, pattern: RegExp) =>
    error instanceof Error && pattern.test(error.message);
  const emptyIfMissing = (error: unknown) => {
    if (missing(error, /no such table: (?:main\.)?project_sites\b/i))
      return { results: [] as SiteRow[] };
    throw error;
  };
  const rows: { results: SiteRow[] } = await env.DB.operations
    .projectSiteEdits(project)
    .execute()
    .catch((error: unknown) => {
      if (missing(error, /no such column: (?:project_sites\.)?removed\b/i))
        return env.DB.operations
          .legacySiteEdits(project)
          .execute()
          .catch(emptyIfMissing);
      return emptyIfMissing(error);
    });
  return {
    added: rows.results.filter((row) => !row.removed).map((row) => row.origin),
    removed: rows.results.filter((row) => row.removed).map((row) => row.origin),
  };
}

/** Apply owner edits on top of a configured project's origins. */
export function editedOrigins(
  origins: string[],
  edits: { added: string[]; removed: string[] },
) {
  return [
    ...origins.filter((origin) => !edits.removed.includes(origin)),
    ...edits.added.filter((origin) => !origins.includes(origin)),
  ];
}

/**
 * Every site allowed to load a project's comments, all owner-editable.
 * Hosted workspaces store them in workspace_domains; configured projects
 * keep their PROJECTS origins with owner edits from project_sites.
 */
export async function projectSites(env: KomoBackendEnv, project: string) {
  const configured = (JSON.parse(env.PROJECTS) as Record<string, Project>)[
    project
  ];
  if (configured)
    return editedOrigins(
      configured.origins,
      await siteEdits(env, project),
    ).sort();
  const rows = await env.DB.operations.workspaceDomains(project).execute();
  return rows.results.map((row) => row.origin);
}

export async function saveProjectSites(
  env: KomoBackendEnv,
  project: string,
  value: unknown,
  origin?: string,
) {
  if (!Array.isArray(value)) throw new HttpError(400, "Send a list of sites.");
  const sites = [...new Set(value.map(sitePattern))];
  const before = await projectSites(env, project);
  if (
    !(!origin || !originAllowed(origin, before) || originAllowed(origin, sites))
  )
    throw new HttpError(400, "You can’t remove the site you’re on.");
  const configured = (JSON.parse(env.PROJECTS) as Record<string, Project>)[
    project
  ];
  const now = Date.now();
  if (configured) {
    const added = sites.filter((site) => !configured.origins.includes(site));
    const removed = configured.origins.filter((site) => !sites.includes(site));
    if (!(added.length <= MAX_SITES))
      throw new HttpError(400, `Add up to ${MAX_SITES} sites.`);
    await env.DB.batch([
      env.DB.operations.deleteProjectSites(project),
      ...added.map((site) =>
        env.DB.operations.insertProjectSite({
          project: project,
          origin: site,
          added_at: now,
        }),
      ),
      ...removed.map((site) =>
        env.DB.operations.insertProjectSite({
          project: project,
          origin: site,
          added_at: now,
          removed: 1,
        }),
      ),
    ]);
  } else {
    if (!(sites.length <= MAX_SITES))
      throw new HttpError(400, `Approve up to ${MAX_SITES} sites.`);
    await env.DB.batch([
      env.DB.operations.deleteWorkspaceDomains(project),
      ...sites.map((site) =>
        env.DB.operations.insertWorkspaceDomain({
          project: project,
          origin: site,
          verified_at: now,
        }),
      ),
    ]);
  }
  return projectSites(env, project);
}
