import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { generateKeyPairSync, verify } from "node:crypto";
import { githubIssueBody } from "../server/github-issue-conversion";
import { readFileSync, readdirSync } from "node:fs";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import worker from "../server/index";
import { createD1Adapter } from "../server/d1-adapter";
import type { KomoBackendEnv } from "../server/database-adapter";
import { digest } from "../server/digest";
import {
  githubAppRead,
  githubTokenExchange,
} from "../server/github-app-client";

vi.mock("../server/setup-client.txt", () => ({ default: "" }));
let sqlite: DatabaseSync;
let env: KomoBackendEnv;
let github: ReturnType<typeof vi.fn>;
let installationAvailable = true;
let repositoryAvailable = true;
const origin = "http://localhost:8788";
const owner = "google:owner";
const botKey = generateKeyPairSync("rsa", { modulusLength: 2048 });
const ctx = { waitUntil: vi.fn() } as unknown as ExecutionContext;

beforeEach(async () => {
  sqlite = new DatabaseSync(":memory:");
  const migrations = new URL("../server/migrations/", import.meta.url);
  for (const file of readdirSync(migrations).sort())
    sqlite.exec(readFileSync(new URL(file, migrations), "utf8"));
  // Exercise real migrations and the real D1 adapter against SQLite, with an atomic D1 transport.
  class Statement {
    constructor(
      readonly query: string,
      readonly values: SQLInputValue[] = [],
    ) {}
    bind(...values: SQLInputValue[]) {
      return new Statement(this.query, values);
    }
    all() {
      const results = sqlite.prepare(this.query).all(...this.values);
      return {
        results,
        success: true,
        meta: {
          changes: Number(sqlite.prepare("SELECT changes() AS n").get()!.n),
        },
      };
    }
    run() {
      return this.all();
    }
    raw() {
      return this.all().results.map((row) => Object.values(row));
    }
  }
  const binding = {
    prepare: (query: string) => new Statement(query),
    batch: async (statements: Statement[]) => {
      sqlite.exec("BEGIN");
      try {
        const results = statements.map((item) => item.all());
        sqlite.exec("COMMIT");
        return results;
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    },
  } as unknown as D1Database;
  env = {
    DB: createD1Adapter(binding),
    PROJECTS: JSON.stringify(
      Object.fromEntries(
        ["one", "two", "other"].map((key) => [
          key,
          { repo: "demo/site", origins: [origin] },
        ]),
      ),
    ),
    GOOGLE_CLIENT_ID: "google",
    GOOGLE_CLIENT_SECRET: "google-secret",
    GITHUB_CLIENT_ID: "",
    GITHUB_CLIENT_SECRET: "",
    GITHUB_APP_ID: "123",
    GITHUB_APP_PRIVATE_KEY: botKey.privateKey
      .export({ type: "pkcs1", format: "pem" })
      .toString(),
    GITHUB_APP_SLUG: "komo",
    GITHUB_APP_CLIENT_ID: "app-client",
    GITHUB_APP_CLIENT_SECRET: "app-secret",
  };
  sqlite.exec(
    "INSERT INTO users(id,name,verified) VALUES('google:owner','Owner',1),('google:other','Other',1),('guest:reviewer','Reviewer',0)",
  );
  for (const project of ["one", "two", "other"]) {
    const user = project === "other" ? "google:other" : owner;
    sqlite
      .prepare("INSERT INTO project_owners(project,user_id) VALUES(?,?)")
      .run(project, user);
    sqlite
      .prepare(
        "INSERT INTO sessions(token_hash,user_id,project,expires_at) VALUES(?,?,?,?)",
      )
      .run(await digest(project), user, project, Date.now() + 1000000);
  }
  sqlite
    .prepare(
      "INSERT INTO sessions(token_hash,user_id,project,expires_at) VALUES(?,?,?,?)",
    )
    .run(await digest("guest"), "guest:reviewer", "one", Date.now() + 1000000);
  installationAvailable = repositoryAvailable = true;
  github = vi.fn(async (input: string, init?: RequestInit) => {
    const url = new URL(input);
    if (url.pathname === "/login/oauth/access_token")
      return Response.json({ access_token: "ghu_secret" });
    if (url.pathname === "/user") return Response.json({ login: "octocat" });
    if (url.pathname === "/user/installations")
      return Response.json({
        total_count: 1,
        installations: installationAvailable
          ? [
              {
                id: 42,
                app_id: 123,
                suspended_at: null,
                account: { login: "octocat" },
              },
            ]
          : [],
      });
    if (url.pathname === "/app/installations/42/access_tokens") {
      const jwt = new Headers(init?.headers)
        .get("Authorization")!
        .slice(7)
        .split(".");
      expect(
        verify(
          "RSA-SHA256",
          Buffer.from(jwt.slice(0, 2).join(".")),
          botKey.publicKey,
          Buffer.from(jwt[2], "base64url"),
        ),
      ).toBe(true);
      if (!installationAvailable) return Response.json({}, { status: 404 });
      const body = JSON.parse(String(init?.body));
      if (!body.repository_ids) {
        expect(body).toEqual({ permissions: { metadata: "read" } });
        return Response.json({ token: "ghs_list" });
      }
      expect(body.permissions).toEqual({ issues: "write" });
      return body.repository_ids[0] === 101 && repositoryAvailable
        ? Response.json({ token: "ghs_bot" })
        : Response.json({}, { status: 422 });
    }
    if (url.pathname === "/installation/repositories")
      return Response.json({
        total_count: 1,
        repositories: repositoryAvailable
          ? [{ id: 101, full_name: "octocat/demo", archived: false }]
          : [],
      });
    if (url.pathname === "/repositories/101")
      return Response.json({
        id: 101,
        full_name: "octocat/demo",
        archived: false,
        has_issues: true,
      });
    if (url.pathname === "/repos/octocat/demo/issues") {
      expect(new Headers(init?.headers).get("Authorization")).toBe(
        "Bearer ghs_bot",
      );
      return Response.json(
        {
          id: 900,
          number: 7,
          html_url: "https://github.com/octocat/demo/issues/7",
        },
        { status: 201 },
      );
    }
    throw Error(
      `Unexpected GitHub request: ${init?.method ?? "GET"} ${url.pathname}`,
    );
  });
  vi.stubGlobal("fetch", github);
});
afterEach(() => {
  vi.unstubAllGlobals();
  sqlite.close();
});

async function request(
  path = "",
  method = "GET",
  data?: unknown,
  project = "one",
  token = project,
) {
  return worker.fetch(
    new Request(`${origin}/project/github${path}?project=${project}`, {
      method,
      headers: {
        Origin: origin,
        Authorization: `Bearer ${token}`,
        ...(data === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: data === undefined ? undefined : JSON.stringify(data),
    }),
    env,
    ctx,
  );
}
async function start(install = false, project = "one") {
  const response = await request("/connect", "POST", { install }, project);
  expect(response.status).toBe(200);
  const { url } = (await response.json()) as { url: string };
  const authorize = await worker.fetch(new Request(url), env, ctx);
  const location = new URL(authorize.headers.get("Location")!);
  const cookie = authorize.headers.get("Set-Cookie")!.split(";")[0];
  return { location, cookie, state: cookie.split("=")[1] };
}
async function callback(state: string, cookie: string) {
  return worker.fetch(
    new Request(`${origin}/auth/github-app/callback?state=${state}&code=code`, {
      headers: { Cookie: cookie },
    }),
    env,
    ctx,
  );
}
async function connect(project = "one") {
  const { state, cookie } = await start(false, project);
  const result = await callback(state, cookie);
  expect(result.status).toBe(200);
  expect(await result.text()).not.toContain('"error"');
}
const count = (table: string) =>
  sqlite.prepare(`SELECT count(*) AS n FROM ${table}`).get()!.n;
const issuePosts = () =>
  github.mock.calls.filter(
    ([url, init]) => String(url).endsWith("/issues") && init?.method === "POST",
  );

async function seedConversion() {
  await connect();
  expect((await request("", "PATCH", { repositoryId: "101" })).status).toBe(
    200,
  );
  sqlite.exec(`INSERT INTO threads(id,project,repo,branch,page,anchor,created_at,updated_at) VALUES('thread','one','demo/site','main','/page','{}',1,1);
    INSERT INTO comments(id,thread_id,user_id,body,created_at) VALUES('first','thread','google:owner','Fix the button',1),('reply','thread','google:other','Also on mobile',2);`);
}
function threadRequest(
  path = "/threads/thread/github-issue",
  method = "POST",
  data: unknown = { title: "Fix button" },
  token = "one",
  branch = "main",
) {
  return worker.fetch(
    new Request(
      `${origin}${path}${path.includes("?") ? "&" : "?"}project=one&repo=demo/site&branch=${branch}`,
      {
        method,
        headers: {
          Origin: origin,
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: method === "GET" ? undefined : JSON.stringify(data),
      },
    ),
    env,
    ctx,
  );
}

it("connects through one authorization and lists repositories without storing GitHub tokens", async () => {
  const { location } = await start();
  expect(location.hostname).toBe("github.com");
  expect(location.pathname).toBe("/login/oauth/authorize");
  expect(location.searchParams.get("client_id")).toBe("app-client");
  expect(location.searchParams.get("code_challenge_method")).toBe("S256");
  await connect();
  const status = await (await request()).json();
  expect(status).toMatchObject({
    connection: { login: "octocat" },
    repository: null,
    repositories: [{ id: "101", name: "octocat/demo" }],
    available: true,
  });
  expect(JSON.stringify(sqlite.prepare("SELECT * FROM project_github").all()))
    .not.toMatch(/ghu_secret|ghs_/);
  expect(count("github_connect_states")).toBe(0);
});

it("sends a person without an installation to GitHub's install page and resumes through setup", async () => {
  installationAvailable = false;
  const { state, cookie } = await start();
  const install = await callback(state, cookie);
  expect(install.status).toBe(302);
  expect(install.headers.get("Location")).toBe(
    `https://github.com/apps/komo/installations/new?state=${state}`,
  );
  expect(count("project_github")).toBe(0);
  installationAvailable = true;
  const setup = await worker.fetch(
    new Request(`${origin}/auth/github-app/setup?installation_id=666`, {
      headers: { Cookie: cookie },
    }),
    env,
    ctx,
  );
  const authorize = new URL(setup.headers.get("Location")!);
  expect(authorize.pathname).toBe("/login/oauth/authorize");
  expect(authorize.searchParams.get("state")).toBe(state);
  expect((await callback(state, cookie)).status).toBe(200);
  expect(
    JSON.parse(
      sqlite.prepare("SELECT installations FROM project_github").get()!
        .installations as string,
    ),
  ).toEqual([{ id: "42", account: "octocat" }]);
  const stray = await worker.fetch(
    new Request(`${origin}/auth/github-app/setup?installation_id=42`),
    env,
    ctx,
  );
  expect(stray.status).toBe(200);
  expect(await stray.text()).toContain("Return to komo");
});

it("opens GitHub's installation page directly to manage access", async () => {
  const { location } = await start(true);
  expect(location.href).toMatch(
    /^https:\/\/github\.com\/apps\/komo\/installations\/new\?state=/,
  );
});

it("creates as the installation bot, links the issue, and resolves the thread", async () => {
  await seedConversion();
  const response = await threadRequest();
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    number: 7,
    url: "https://github.com/octocat/demo/issues/7",
    repository: "octocat/demo",
  });
  const body = JSON.parse(String(issuePosts()[0][1]?.body)).body;
  expect(body).toContain("Issue originates from comment by **Owner**:");
  expect(body).toContain("**Other:** Also on mobile");
  expect(body).toContain("http://localhost:8788/page?comment=thread");
  expect(
    sqlite.prepare("SELECT resolved FROM threads WHERE id='thread'").get()!
      .resolved,
  ).toBe(1);
  expect((await threadRequest()).status).toBe(200);
  expect(issuePosts()).toHaveLength(1);
  // The thread stays an ordinary thread: it can be reopened and discussed.
  expect(
    (await threadRequest("/threads/thread", "PATCH", { resolved: false }))
      .status,
  ).toBe(200);
  expect(
    (
      await threadRequest("/threads/thread/comments", "POST", {
        body: "Late reply",
      })
    ).status,
  ).toBe(201);
  await request("", "DELETE");
  const list = await threadRequest("/threads", "GET");
  expect(
    ((await list.json()) as { threads: { githubIssue: unknown }[] }).threads[0]
      .githubIssue,
  ).toEqual({
    url: "https://github.com/octocat/demo/issues/7",
    number: 7,
    repository: "octocat/demo",
  });
});

it("allows invited members, rejects guests and merely signed-in visitors, and enforces branch scope", async () => {
  await seedConversion();
  sqlite
    .prepare(
      "INSERT INTO sessions(token_hash,user_id,project,expires_at) VALUES(?,?,?,?)",
    )
    .run(await digest("visitor"), "google:other", "one", Date.now() + 100000);
  expect(
    (await threadRequest(undefined, undefined, undefined, "guest")).status,
  ).toBe(403);
  expect(
    (await threadRequest(undefined, undefined, undefined, "visitor")).status,
  ).toBe(403);
  expect(
    (await threadRequest(undefined, undefined, undefined, "one", "other"))
      .status,
  ).toBe(404);
  sqlite.exec(
    "INSERT INTO project_access(project,user_id) VALUES('one','google:other')",
  );
  expect(
    (await threadRequest(undefined, undefined, undefined, "visitor")).status,
  ).toBe(200);
});

it.each([
  ["a rejection", () => Promise.resolve(Response.json({}, { status: 422 }))],
  ["a lost response", () => Promise.reject(new Error("Response lost"))],
])("releases the thread after %s so it can be retried", async (_, fail) => {
  await seedConversion();
  const normal = github.getMockImplementation()!;
  github.mockImplementation((url, init) =>
    new URL(url).pathname === "/repos/octocat/demo/issues"
      ? fail()
      : normal(url, init),
  );
  expect((await threadRequest()).status).toBeGreaterThanOrEqual(409);
  expect(count("thread_github_issues")).toBe(0);
  expect(
    sqlite.prepare("SELECT resolved FROM threads WHERE id='thread'").get()!
      .resolved,
  ).toBe(0);
  expect(
    (
      await threadRequest("/threads/thread/comments", "POST", {
        body: "Still open",
      })
    ).status,
  ).toBe(201);
  github.mockImplementation(normal);
  expect((await threadRequest()).status).toBe(200);
});

it("rejects a concurrent conversion and recovers an abandoned reservation", async () => {
  await seedConversion();
  const normal = github.getMockImplementation()!;
  let finish!: () => void;
  const pending = new Promise<void>((resolve) => {
    finish = resolve;
  });
  github.mockImplementation(async (url, init) => {
    if (new URL(url).pathname === "/repos/octocat/demo/issues") await pending;
    return normal(url, init);
  });
  const first = threadRequest();
  await vi.waitFor(() => expect(issuePosts()).toHaveLength(1));
  expect((await threadRequest()).status).toBe(409);
  finish();
  expect((await first).status).toBe(200);
  expect(issuePosts()).toHaveLength(1);

  sqlite.exec(
    "DELETE FROM thread_github_issues; UPDATE threads SET resolved=0; INSERT INTO thread_github_issues(thread_id,project,repository_name,created_by,created_at) VALUES('thread','one','octocat/demo','google:owner',1)",
  );
  expect((await threadRequest()).status).toBe(200);
});

it("lists threads for an expired session and hides pending conversions", async () => {
  await seedConversion();
  sqlite.exec(
    "INSERT INTO thread_github_issues(thread_id,project,repository_name,created_by,created_at) VALUES('thread','one','octocat/demo','google:owner',1)",
  );
  const expired = await threadRequest("/threads", "GET", undefined, "expired");
  expect(expired.status).toBe(200);
  const result = (await expired.json()) as {
    githubRepository: unknown;
    threads: { githubIssue?: unknown }[];
  };
  expect(result.githubRepository).toBeNull();
  expect(result.threads[0].githubIssue).toBeUndefined();
});

it("exports conversion links without credentials and includes fresh member capability on unchanged lists", async () => {
  await seedConversion();
  const initial = (await (await threadRequest("/threads", "GET")).json()) as {
    revision: number;
    githubRepository: string;
  };
  expect(initial.githubRepository).toBe("octocat/demo");
  const cached = await (
    await threadRequest(`/threads?revision=${initial.revision}`, "GET")
  ).json();
  expect(cached).toMatchObject({
    notModified: true,
    githubRepository: "octocat/demo",
  });
  await threadRequest();
  const exported = (await (
    await threadRequest("/project/export?table=github_issues", "GET")
  ).json()) as { rows: Record<string, unknown>[] };
  expect(exported.rows[0]).toMatchObject({
    issue_number: 7,
    repository_name: "octocat/demo",
  });
  expect(Object.keys(exported.rows[0]).sort()).toEqual([
    "created_at",
    "created_by",
    "issue_number",
    "issue_url",
    "repository_name",
    "thread_id",
  ]);
  const importedId = "import:" + (await digest("one\noriginal\nthread"));
  sqlite
    .prepare("INSERT INTO users(id,name,verified) VALUES(?,'Owner',0)")
    .run("guest:import:" + (await digest("one\noriginal\ngoogle:owner")));
  sqlite
    .prepare(
      "INSERT INTO threads(id,project,repo,branch,page,anchor,created_at,updated_at) VALUES(?,'one','demo/site','main','/page','{}',1,1)",
    )
    .run(importedId);
  const imported = await threadRequest("/project/import", "POST", {
    source: "original",
    kind: "github_issues",
    records: exported.rows,
  });
  expect(imported.status).toBe(200);
  expect(
    sqlite
      .prepare("SELECT issue_url FROM thread_github_issues WHERE thread_id=?")
      .get(importedId)!.issue_url,
  ).toBe("https://github.com/octocat/demo/issues/7");
});

it("formats empty reply sections and rejects oversized discussion without truncation", () => {
  expect(githubIssueBody([{ name: "A", body: "Hello\nworld" }])).not.toContain(
    "## Replies",
  );
  expect(() =>
    githubIssueBody([{ name: "A", body: "x".repeat(65000) }]),
  ).toThrow("too long");
});

it("requires the project owner and keeps connections isolated by project", async () => {
  expect((await request("", "GET", undefined, "one", "guest")).status).toBe(
    403,
  );
  expect(
    (await request("/connect", "POST", {}, "one", "other")).status,
  ).toBe(401);
  await connect();
  for (const project of ["two", "other"])
    expect(
      ((await (await request("", "GET", undefined, project)).json()) as {
        connection: unknown;
      }).connection,
    ).toBeNull();
});

it("requires the OAuth browser cookie, one-use state, and a live owner session", async () => {
  const first = await start();
  expect((await callback(first.state, "")).status).toBe(400);
  await callback(first.state, first.cookie);
  expect((await callback(first.state, first.cookie)).status).toBe(400);
  const second = await start();
  sqlite
    .prepare("DELETE FROM sessions WHERE token_hash=?")
    .run(await digest("one"));
  expect((await callback(second.state, second.cookie)).status).toBe(400);
});

it("validates the selected repository with a repository-scoped issue token", async () => {
  expect((await request("", "PATCH", { repositoryId: "101" })).status).toBe(
    409,
  );
  await connect();
  expect((await request("", "PATCH", { repositoryId: "999" })).status).toBe(
    403,
  );
  expect((await request("", "PATCH", { repositoryId: "101" })).status).toBe(
    200,
  );
  expect(
    sqlite
      .prepare(
        "SELECT installation_id,repository_id,repository_name FROM project_github",
      )
      .get(),
  ).toEqual({
    installation_id: "42",
    repository_id: "101",
    repository_name: "octocat/demo",
  });
  expect(
    github.mock.calls.some(([url]) =>
      String(url).includes("/installation/repositories"),
    ),
  ).toBe(false);
});

it("detects repository loss and disconnects only the current project", async () => {
  await connect();
  await connect("two");
  await request("", "PATCH", { repositoryId: "101" });
  repositoryAvailable = false;
  expect(await (await request()).json()).toMatchObject({
    available: false,
    repository: { id: "101", name: "octocat/demo" },
    connection: { login: "octocat" },
  });
  expect((await request("", "DELETE")).status).toBe(200);
  expect(
    sqlite.prepare("SELECT project FROM project_github").all(),
  ).toEqual([{ project: "two" }]);
});

it("removes an uninstalled installation like GitHub's installation.deleted event", async () => {
  await connect();
  await request("", "PATCH", { repositoryId: "101" });
  installationAvailable = false;
  expect(await (await request()).json()).toEqual({
    configured: true,
    connection: null,
    repository: null,
    repositories: [],
    removed: true,
  });
  expect(count("project_github")).toBe(0);
});

it("keeps other installations and drops only the uninstalled one", async () => {
  await connect();
  await request("", "PATCH", { repositoryId: "101" });
  sqlite.exec(
    `UPDATE project_github SET installations='[{"id":"42","account":"octocat"},{"id":"66","account":"gone"}]'`,
  );
  const original = github.getMockImplementation()!;
  github.mockImplementation(async (url, init) =>
    new URL(url).pathname === "/app/installations/66/access_tokens"
      ? Response.json({}, { status: 404 })
      : original(url, init),
  );
  expect(await (await request()).json()).toMatchObject({
    connection: { login: "octocat" },
    repository: { id: "101" },
    removed: true,
    available: true,
  });
  expect(sqlite.prepare("SELECT installations FROM project_github").get()).toEqual({
    installations: JSON.stringify([{ id: "42", account: "octocat" }]),
  });
});

it.each([
  [401, "credentials are invalid"],
  [403, "suspended"],
  [502, "unavailable"],
])("never disconnects on GitHub %s", async (status, message) => {
  await connect();
  await request("", "PATCH", { repositoryId: "101" });
  const original = github.getMockImplementation()!;
  github.mockImplementation(async (url, init) =>
    new URL(url).pathname === "/app/installations/42/access_tokens"
      ? Response.json({}, { status })
      : original(url, init),
  );
  const result = (await (await request()).json()) as {
    error: string;
    connection: unknown;
  };
  expect(result.error).toContain(message);
  expect(result.connection).toEqual({ login: "octocat" });
  expect(
    sqlite.prepare("SELECT repository_id FROM project_github").get(),
  ).toEqual({ repository_id: "101" });
});

it("keeps a selection on reconnection only while its installation is still verified", async () => {
  await connect();
  await request("", "PATCH", { repositoryId: "101" });
  await connect();
  expect(
    sqlite.prepare("SELECT repository_id FROM project_github").get()!
      .repository_id,
  ).toBe("101");
  const original = github.getMockImplementation()!;
  github.mockImplementation(async (url, init) =>
    new URL(url).pathname === "/user/installations"
      ? Response.json({
          installations: [
            { id: 66, app_id: 123, suspended_at: null, account: { login: "another" } },
            { id: 99, app_id: 999, suspended_at: null, account: { login: "other-app" } },
          ],
        })
      : original(url, init),
  );
  await connect();
  expect(sqlite.prepare("SELECT * FROM project_github").get()).toMatchObject({
    installations: JSON.stringify([{ id: "66", account: "another" }]),
    installation_id: null,
    repository_id: null,
  });
});

it("does not resurrect a connection when it is disconnected during OAuth", async () => {
  const { state, cookie } = await start();
  const original = github.getMockImplementation()!;
  github.mockImplementation(async (url, init) => {
    if (new URL(url).pathname === "/user") await request("", "DELETE");
    return original(url, init);
  });
  expect(await (await callback(state, cookie)).text()).toContain(
    "GitHub connection changed",
  );
  expect(count("project_github")).toBe(0);
});

it("hides unavailable configuration and rejects unrecognized write fields", async () => {
  env.GITHUB_APP_PRIVATE_KEY = "";
  expect(
    ((await (await request()).json()) as { configured: boolean }).configured,
  ).toBe(false);
  expect((await request("/connect", "POST", {})).status).toBe(503);
  expect(
    (
      await request("", "PATCH", {
        repositoryId: "101",
        ownerId: "google:other",
      })
    ).status,
  ).toBe(400);
});

it("uses Workers-compatible manual redirects and never follows OAuth or API redirects", async () => {
  github.mockImplementation(async (_url, init) => {
    // Workers supports only follow/manual; Node fetch alone does not catch this regression.
    expect(init?.redirect).toBe("manual");
    return new Response(null, {
      status: 302,
      headers: { Location: "https://untrusted.example/" },
    });
  });
  await expect(githubTokenExchange(env, { code: "test-code" })).rejects.toThrow(
    "unexpected redirect",
  );
  await expect(githubAppRead("test-token", "/user")).rejects.toThrow(
    "unexpected redirect",
  );
  expect(github.mock.calls.map(([url]) => new URL(url).hostname)).toEqual([
    "github.com",
    "api.github.com",
  ]);
});

it("paginates repository choices without following supplied URLs", async () => {
  await connect();
  const original = github.getMockImplementation()!;
  github.mockImplementation(async (url, init) => {
    const parsed = new URL(url);
    if (parsed.pathname === "/installation/repositories") {
      const page = parsed.searchParams.get("page");
      return Response.json({
        total_count: 101,
        repositories:
          page === "1"
            ? Array.from({ length: 100 }, (_, i) => ({
                id: i + 1,
                full_name: `octocat/repo-${String(i).padStart(3, "0")}`,
                archived: false,
              }))
            : [{ id: 200, full_name: "octocat/zz-last", archived: true }],
      });
    }
    return original(url, init);
  });
  const { repositories } = (await (await request()).json()) as {
    repositories: unknown[];
  };
  expect(repositories).toHaveLength(100);
  expect(
    github.mock.calls.some(([url]) =>
      url.includes("/installation/repositories?per_page=100&page=2"),
    ),
  ).toBe(true);
});

it("authorizes hosted management against the selected workspace, not the management session", async () => {
  env.KOMO_HOSTED = "true";
  sqlite
    .prepare(
      "INSERT INTO sessions(token_hash,user_id,project,expires_at) VALUES(?,?,?,?)",
    )
    .run(await digest("hosted-owner"), owner, "_komo", Date.now() + 1000000);
  for (const [workspace, expected] of [
    ["one", 200],
    ["other", 403],
  ] as const) {
    const response = await worker.fetch(
      new Request(
        `${origin}/project/github?project=_komo&workspace=${workspace}`,
        {
          headers: { Origin: origin, Authorization: "Bearer hosted-owner" },
        },
      ),
      env,
      ctx,
    );
    expect(response.status).toBe(expected);
  }
});
