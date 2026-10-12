import { readFile, writeFile, stat } from "node:fs/promises";
import { resolve } from "node:path";

export const projectHelp = `
Project commands (Google owner):
  komo project info
  komo project export --out comments.json
  komo project import --file comments.json
  komo project access --access public|private
  komo project invite --email name@example.com
  komo project join --invite TOKEN
  komo project revoke --email name@example.com
  komo project remove-member --user USER_ID
  komo project clear-resolved --confirm PROJECT_KEY
  komo project delete --confirm PROJECT_KEY
Exports exclude credentials. Imports preserve feedback with unverified imported identities.
`;
export async function runProject(action, flags, request, config, cwd) {
  const requireValue = (name) => {
    if (!flags[name]) throw Error(`Supply --${name}.`);
    return flags[name];
  };
  if (action === "info" || action === "list") return request("project");
  if (action === "export") {
    const path = resolve(cwd, requireValue("out"));
    const snapshot = {
      format: "komo-export",
      version: 1,
      project: config.project,
      exportedAt: new Date().toISOString(),
      tables: {},
    };
    let revision;
    for (const table of ["users", "threads", "comments", "reactions", "github_issues"]) {
      snapshot.tables[table] = [];
      let offset = 0;
      do {
        const page = await request(
          `project/export?table=${table}&offset=${offset}${revision === undefined ? "" : `&revision=${revision}`}`
        );
        revision = page.revision;
        snapshot.tables[table].push(...page.rows);
        offset = page.next;
      } while (offset !== null);
    }
    await writeFile(path, JSON.stringify(snapshot, null, 2), {
      mode: 0o600,
      flag: "wx",
    });
    return {
      file: path,
      counts: Object.fromEntries(
        Object.entries(snapshot.tables).map(([key, rows]) => [key, rows.length])
      ),
    };
  }
  if (action === "import") {
    const path = resolve(cwd, requireValue("file"));
    if ((await stat(path)).size > 50 * 1024 * 1024)
      throw Error("Import files must be under 50 MB.");
    const snapshot = JSON.parse(await readFile(path, "utf8"));
    if (
      snapshot.format !== "komo-export" ||
      snapshot.version !== 1 ||
      typeof snapshot.project !== "string" ||
      !snapshot.tables
    )
      throw Error("Use a version 1 komo export.");
    let imported = 0;
    for (const kind of ["users", "threads", "comments", "reactions", "github_issues"]) {
      if (kind === "github_issues" && snapshot.tables[kind] === undefined) continue;
      if (!Array.isArray(snapshot.tables[kind]))
        throw Error(`Missing ${kind} table.`);
      let records = [];
      const send = async () => {
        if (records.length) {
          const result = await request("project/import", "POST", {
            source: snapshot.project,
            kind,
            records,
          });
          imported += result.imported;
          records = [];
        }
      };
      for (const row of snapshot.tables[kind]) {
        if (
          Buffer.byteLength(
            JSON.stringify({
              source: snapshot.project,
              kind,
              records: [...records, row],
            })
          ) > 15000 ||
          records.length >= 50
        )
          await send();
        if (
          Buffer.byteLength(
            JSON.stringify({ source: snapshot.project, kind, records: [row] })
          ) > 16000
        )
          throw Error(`An imported ${kind} record exceeds 16 KB.`);
        records.push(row);
      }
      await send();
    }
    return {
      imported,
      note: "Imported identities are unverified. Re-running this export is idempotent.",
    };
  }
  if (action === "access")
    return request("project", "PATCH", { access: requireValue("access") });
  if (action === "invite")
    return request("project/invites", "POST", { email: requireValue("email") });
  if (action === "revoke")
    return request("project/invites", "DELETE", {
      email: requireValue("email"),
    });
  if (action === "remove-member")
    return request("project/members", "DELETE", { user: requireValue("user") });
  if (action === "join")
    return request("project/join", "POST", { invite: requireValue("invite") });
  if (action === "delete" || action === "clear-resolved") {
    if (requireValue("confirm") !== config.project)
      throw Error(
        "--confirm must match the project key. Export first; deletion is permanent."
      );
    return request(
      action === "delete" ? "project" : "project/clear-resolved",
      action === "delete" ? "DELETE" : "POST",
      { confirm: flags.confirm }
    );
  }
  throw Error("Unknown project action. Run komo --help.");
}
