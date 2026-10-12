import { createHash } from "node:crypto";
import { execFile, spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { createServer } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Thread } from "../src/types";
import { startPostgresApiFixture } from './postgres-api-fixture';

const root = fileURLToPath(new URL("../../../", import.meta.url));
let directory = "",
  worker: ChildProcess | undefined,
  port = 0,
  output = "";
const origin = "http://localhost:4321";
const postgresConnection = process.env.KOMO_TEST_API_DATABASE === 'postgres'
  ? process.env.KOMO_TEST_POSTGRES_URL : undefined;
let disposePostgres: (()=>Promise<void>) | undefined;
const anchor = {
  selector: "#hero",
  text: "Workers",
  x: 0.2,
  y: 0.3,
  width: 0.1,
  height: 0.1,
  pageX: 200,
  pageY: 300,
  viewportWidth: 1200,
  source: "src/pages/products/workers.astro",
};
async function request(
  path: string,
  method = "GET",
  data?: unknown,
  token?: string,
  branch = "feature/a",
  repo = "owner/site",
  project = "test"
) {
  const url = new URL(path, `http://localhost:${port}`);
  url.searchParams.set("project", project);
  url.searchParams.set("repo", repo);
  url.searchParams.set("branch", branch);
  const headers: Record<string, string> = {
    Origin: project === "_komo" ? `http://localhost:${port}` : origin,
  };
  if (data !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(url, {
    method,
    headers,
    body: data === undefined ? undefined : JSON.stringify(data),
  });
}
beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "branch-comments-test-"));
  port = await new Promise<number>((resolve) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const value = typeof address === "object" && address ? address.port : 0;
      server.close(() => resolve(value));
    });
  });
  const config = JSON.parse(
    await readFile(new URL("../server/wrangler.jsonc", import.meta.url), "utf8")
  );
  config.name = "comments-test";
  const apiPath = fileURLToPath(new URL("../server/index.ts", import.meta.url));
  config.main = join(directory, "worker.ts");
  // Mock only Google's upstream responses in the test Worker; exercise the real
  // OAuth callback, state cookie, database provisioning and scoped session code.
  await writeFile(
    config.main,
    `
    import api from ${JSON.stringify(apiPath)};
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input, init) => {
      const url = String(input);
      if (url === "https://oauth2.googleapis.com/token") {
        return new URLSearchParams(init?.body).get("code") === "fixture-setup-success"
          ? Response.json({access_token:"fixture-google-access"})
          : Response.json({error:"invalid_grant"}, {status:400});
      }
      if (url === "https://openidconnect.googleapis.com/v1/userinfo")
        return Response.json({sub:"in-project-fixture",name:"Setup Owner",email_verified:true,email:"setup@example.test"});
      return originalFetch(input, init);
    };
    export default api;
  `
  );
  delete config.account_id;
  config.vars.PROJECTS = JSON.stringify({
    test: { repo: "owner/site", origins: [origin] },
    cli: { repo: "owner/site", origins: [origin] },
    other: { repo: "owner/site", origins: [origin] },
    demo: { repo: "owner/site", origins: [origin], retainedCommentsPerUser: 3 },
    owned: {
      repo: "owner/site",
      origins: [origin, "https://docs.example.com"],
      requireOwner: true,
    },
    unclaimed: {
      repo: "owner/site",
      origins: [origin],
      requireOwner: true,
      bootstrapHash: createHash("sha256")
        .update("test-owner-key")
        .digest("hex"),
    },
  });
  config.vars.KOMO_HOSTED = "true";
  config.vars.GOOGLE_CLIENT_ID = "fixture-client";
  config.vars.GOOGLE_CLIENT_SECRET = "fixture-secret-not-a-real-credential";
  config.d1_databases = [
    {
      binding: "DB",
      database_name: "test",
      database_id: "test",
      migrations_dir: fileURLToPath(
        new URL("../server/migrations", import.meta.url)
      ),
    },
  ];
  const configPath = join(directory, "wrangler.json");
  await writeFile(configPath, JSON.stringify(config));
  if (!postgresConnection) await promisify(execFile)(
    "pnpm",
    [
      "exec",
      "wrangler",
      "d1",
      "migrations",
      "apply",
      "DB",
      "--local",
      "--persist-to",
      join(directory, "state"),
      "--config",
      configPath,
    ],
    { cwd: root, timeout: 45000 }
  );
  const seed = join(directory, "seed.sql");
  const h = (value: string) => createHash("sha256").update(value).digest("hex");
  await writeFile(
    seed,
    `
    INSERT INTO users(id,name,verified) VALUES('google:fixture','Owner',1),('guest:fixture','Guest',0);
    INSERT INTO threads(id,project,repo,branch,page,anchor,created_at,updated_at)
    VALUES ${Array.from({length:65},(_,i)=>`('import:${String(i+1).padStart(3,'0')}','test','owner/site','pagination','/','${JSON.stringify(anchor)}',100,100)`).join(',')};
    INSERT INTO project_owners(project,user_id) VALUES('owned','google:fixture');
    INSERT INTO project_members(project,user_id) VALUES('other','google:fixture'),('removed-project','google:fixture');
    INSERT INTO users(id,name,verified) VALUES('google:usage','Usage owner',1);
    INSERT INTO workspaces(id,owner_id,repo,origins,created_at) VALUES('usage-project','google:usage','owner/site','["http://localhost:4321"]',1);
    INSERT INTO project_owners(project,user_id) VALUES('usage-project','google:usage');
    INSERT INTO project_quotas(project,max_comments,max_bytes,comments) VALUES('usage-project',250,10485760,249);
    INSERT INTO sessions(token_hash,user_id,project,expires_at) VALUES('${h("usage-owner-token")}','google:usage','usage-project',9999999999999);

    INSERT INTO users(id,name,verified,email) VALUES('google:management','Manager',1,'owner@example.com'),('google:member','Member',1,'member@example.com'),('google:stranger','Stranger',1,'stranger@example.com');
    INSERT INTO workspaces(id,owner_id,repo,origins,created_at) VALUES('managed','google:management','owner/site','["http://localhost:4321"]',1),('destination','google:management','owner/site','["http://localhost:4321"]',1);
    INSERT INTO project_owners(project,user_id) VALUES('managed','google:management'),('destination','google:management');
    INSERT INTO project_quotas(project,max_comments,max_bytes) VALUES('managed',250,10485760),('destination',250,10485760);
    INSERT INTO sessions(token_hash,user_id,project,expires_at) VALUES
      ('${h("managed-owner")}','google:management','managed',9999999999999),
      ('${h("destination-owner")}','google:management','destination',9999999999999),
      ('${h("managed-member")}','google:member','managed',9999999999999),
      ('${h("managed-stranger")}','google:stranger','managed',9999999999999),
      ('${h("manage-control")}','google:management','_komo',9999999999999);
    INSERT INTO project_quotas(project,max_comments,max_bytes) VALUES('owned',1,100000),('demo',100,100000);
    INSERT INTO sessions(token_hash,user_id,project,expires_at) VALUES
      ('${h("owner-token")}','google:fixture','_komo',9999999999999),
      ('${h("guest-management-token")}','guest:fixture','_komo',9999999999999),
      ('${h("owned-token")}','google:fixture','owned',9999999999999),
      ('${h("claim-token")}','google:fixture','unclaimed',9999999999999),
      ('${h("guest-claim-token")}','guest:fixture','unclaimed',9999999999999);
  `
  );
  if (postgresConnection) {
    const fixture=await startPostgresApiFixture({connection:postgresConnection,directory,seed:await readFile(seed,'utf8'),vars:config.vars,port,workerPath:config.main});
    worker=fixture.process;
    disposePostgres=fixture.dispose;
  } else {
  await promisify(execFile)(
    "pnpm",
    [
      "exec",
      "wrangler",
      "d1",
      "execute",
      "DB",
      "--local",
      "--persist-to",
      join(directory, "state"),
      "--config",
      configPath,
      "--file",
      seed,
    ],
    { cwd: root, timeout: 45000 }
  );
  worker = spawn(
    "pnpm",
    [
      "exec",
      "wrangler",
      "dev",
      "--config",
      configPath,
      "--port",
      String(port),
      "--persist-to",
      join(directory, "state"),
    ],
    { cwd: root, stdio: ["ignore", "pipe", "pipe"], detached: true }
  );
  }
  worker.stdout?.on("data", (chunk) => (output += String(chunk)));
  worker.stderr?.on("data", (chunk) => (output += String(chunk)));
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(`http://localhost:${port}/health`)).ok) return;
    } catch {
      /* Wait for the API server. */
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Worker failed to start: ${output}`);
});
afterAll(async () => {
  if (worker?.pid) {
    try {
      process.kill(-worker.pid, "SIGTERM");
    } catch {
      /* Already stopped. */
    }
  }
  if (directory) await rm(directory, { recursive: true, force: true });
  await disposePostgres?.();
});
it("connects from the intended site with a one-use Google handoff and project-scoped session", async () => {
  const site = "https://new-site.example";
  const setup = (await (
    await request("setup/start", "POST", {
      repo: "owner/new-site",
      origins: [site, "https://other-site.example"],
    })
  ).json()) as { id: string; secret: string };
  const connect = (
    origin: string,
    sites = [origin, "https://production.example"]
  ) =>
    fetch(
      `http://localhost:${port}/setup/connect?code=${setup.id}&origin=${encodeURIComponent(origin)}&sites=${encodeURIComponent(JSON.stringify(sites))}`,
      { redirect: "manual" }
    );
  expect((await connect("https://attacker.example")).status).toBe(403);
  expect((await connect(`${site}/path`)).status).toBe(403);
  expect((await connect(site, ["https://production.example"])).status).toBe(
    400
  );
  expect((await connect(site, [site, "http://untrusted.example"])).status).toBe(
    400
  );
  const start = await connect(site);
  expect(start.status).toBe(302);
  const authorize = new URL(start.headers.get("Location")!);
  expect(authorize.origin).toBe("https://accounts.google.com");
  const state = authorize.searchParams.get("state")!;
  const callback = `http://localhost:${port}/auth/google/callback?state=${encodeURIComponent(state)}&code=fixture-setup-success`;
  expect((await fetch(callback)).status).toBe(400);
  const signedIn = await fetch(callback, {
    headers: { Cookie: `__Host-comments-oauth=${state}` },
  });
  expect(signedIn.status).toBe(200);
  const html = await signedIn.text();
  const payload = JSON.parse(
    html.match(/postMessage\((.+),"https:\/\/new-site\.example"\)/)![1]
  );
  expect(payload).toMatchObject({
    type: "komo:setup",
    code: setup.id,
    repo: "owner/new-site",
    user: { id: "google:in-project-fixture", verified: true },
  });
  const scoped = (project: string, origin = site) =>
    fetch(`http://localhost:${port}/me?project=${project}`, {
      headers: { Origin: origin, Authorization: `Bearer ${payload.token}` },
    });
  expect((await scoped(payload.project)).status).toBe(200);
  expect(
    (await scoped(payload.project, "https://production.example")).status
  ).toBe(200);
  expect((await scoped("_komo", `http://localhost:${port}`)).status).toBe(401);
  const approved = await fetch(
    `http://localhost:${port}/config?project=${payload.project}`,
    { headers: { Origin: site } }
  );
  expect(approved.status).toBe(200);
  expect(approved.headers.get("Access-Control-Allow-Origin")).toBe(site);
  expect(
    (await scoped(payload.project, "https://other-site.example")).status
  ).toBe(403);
  const poll = await (
    await request("setup/poll", "POST", { id: setup.id, secret: setup.secret })
  ).json();
  expect(poll.project).toBe(payload.project);
  expect(poll.token).toBeUndefined();
  expect((await connect(site)).status).toBe(409);
  expect(
    (
      await fetch(callback, {
        headers: { Cookie: `__Host-comments-oauth=${state}` },
      })
    ).status
  ).toBe(400);
});

describe("shared comments against real workerd and SQLite", () => {
  it("resolves project-only configuration to the existing repository", async () => {
    const canonical = await request(
      "/threads",
      "GET",
      undefined,
      undefined,
      "feature/a"
    );
    const inferred = await request(
      "/threads",
      "GET",
      undefined,
      undefined,
      "feature/a",
      "test"
    );
    expect(inferred.status).toBe(200);
    expect(await inferred.json()).toEqual(await canonical.json());
    const mismatch = await request(
      "/threads",
      "GET",
      undefined,
      undefined,
      "feature/a",
      "wrong/repo"
    );
    expect(mismatch.status).toBe(403);
  });
  it("keeps a demo reviewer's newest three messages across pages and branches, preserving other reviewers", async () => {
    const call = (
      path: string,
      method = "GET",
      data?: unknown,
      token?: string,
      branch = "shared"
    ) => request(path, method, data, token, branch, "owner/site", "demo");
    const alice = await (
      await call("/auth/guest", "POST", { name: "Alice demo" })
    ).json();
    const bob = await (
      await call("/auth/guest", "POST", { name: "Bob demo" })
    ).json();
    const create = async (body: string, branch = "shared") => {
      const response = await call(
        "/threads",
        "POST",
        { page: "/", anchor, body },
        alice.token,
        branch
      );
      expect(response.status).toBe(201);
      return response.json();
    };
    const first = await create("Old root");
    await call(
      `/threads/${first.id}/comments`,
      "POST",
      { body: "Keep Bob's reply" },
      bob.token
    );
    const second = await create("Old empty thread", "other-page");
    const oldScope = await (
      await call("/threads", "GET", undefined, undefined, "other-page")
    ).json();
    await create("Third");
    await call(
      `/threads/${first.id}/comments`,
      "POST",
      { body: "Newest reply" },
      alice.token
    );
    let list = await (await call("/threads")).json();
    expect(
      list.threads
        .find((t: Thread) => t.id === first.id)
        .comments.map((c: { body: string }) => c.body)
    ).toEqual(["Keep Bob's reply", "Newest reply"]);
    await Promise.all([create("Concurrent A"), create("Concurrent B")]);
    list = await (await call("/threads")).json();
    const messages = list.threads.flatMap((t: Thread) => t.comments);
    expect(
      messages.filter(
        (c: { author: { id: string } }) => c.author.id === alice.user.id
      )
    ).toHaveLength(3);
    expect(
      messages.some((c: { body: string }) => c.body === "Keep Bob's reply")
    ).toBe(true);
    const pruned = await (
      await call("/threads", "GET", undefined, undefined, "other-page")
    ).json();
    expect(pruned.threads.some((t: Thread) => t.id === second.id)).toBe(false);
    expect(pruned.revision).not.toBe(oldScope.revision);
    const usage = await (
      await call("/usage", "GET", undefined, alice.token)
    ).json();
    expect(usage.comments.used).toBe(4);
    const regular = await (
      await request("/auth/guest", "POST", { name: "Regular reviewer" })
    ).json();
    for (let i = 0; i < 4; i++) {
      expect(
        (
          await request(
            "/threads",
            "POST",
            { page: "/", anchor, body: `Keep ${i}` },
            regular.token,
            "retention-off"
          )
        ).status
      ).toBe(201);
    }
    const unchanged = await (
      await request("/threads", "GET", undefined, undefined, "retention-off")
    ).json();
    expect(unchanged.threads).toHaveLength(4);
  });
  it("rejects using the management session as an unmetered comment project", async () => {
    expect(
      (
        await request(
          "/threads",
          "POST",
          { body: "Bypass", page: "/", anchor },
          "owner-token",
          "shared",
          "_komo",
          "_komo"
        )
      ).status
    ).toBe(404);
  });

  it("persists moved anchors and rejects moves by unrelated guests", async () => {
    const owner = await (
      await request("/auth/guest", "POST", { name: "Mover" })
    ).json();
    const other = await (
      await request("/auth/guest", "POST", { name: "Other" })
    ).json();
    const branch = "feature/moving";
    const captured = { ...anchor, context: { tag: "button", label: "Save", scope: "main > form", styles: "display: flex" } };
    const { id } = await (
      await request(
        "/threads",
        "POST",
        { page: "/", anchor: captured, body: "Move me" },
        owner.token,
        branch
      )
    ).json();
    const initial = await (await request("/threads", "GET", undefined, undefined, branch)).json();
    expect(initial.threads[0].anchor).toEqual(captured);
    const moved = { ...captured, x: 0.6, y: 0.2, unstacked: true };
    expect(
      (
        await request(
          `/threads/${id}`,
          "PATCH",
          { anchor: moved },
          other.token,
          branch
        )
      ).status
    ).toBe(403);
    expect(
      (
        await request(
          `/threads/${id}`,
          "PATCH",
          { anchor: moved },
          owner.token,
          "wrong-branch"
        )
      ).status
    ).toBe(404);
    expect(
      (
        await request(
          `/threads/${id}`,
          "PATCH",
          { anchor: { ...moved, x: 2 } },
          owner.token,
          branch
        )
      ).status
    ).toBe(400);
    expect(
      (
        await request(
          `/threads/${id}`,
          "PATCH",
          { anchor: moved },
          owner.token,
          branch
        )
      ).status
    ).toBe(200);
    const result = await (
      await request("/threads", "GET", undefined, undefined, branch)
    ).json();
    expect(result.threads[0].anchor).toEqual(moved);
    const compact = await (await request("/threads?authors=1", "GET", undefined, undefined, branch)).json();
    expect(compact.threads[0].comments[0].author).toBe(owner.user.id);
    expect(compact.authors[owner.user.id]).toEqual(result.threads[0].comments[0].author);
    expect(compact.threads.map((thread: any) => ({
      ...thread,
      resolvedBy: thread.resolvedBy === null ? null : compact.authors[thread.resolvedBy],
      comments: thread.comments.map((comment: any) => ({...comment, author: compact.authors[comment.author]})),
    }))).toEqual(result.threads);
    expect(result.threads[0].resolved).toBe(false);
    expect((await request(`/threads/${id}`, "PATCH", { resolved: true }, owner.token, branch)).status).toBe(200);
    const resolvedCompact = await (await request("/threads?authors=1", "GET", undefined, undefined, branch)).json();
    expect(resolvedCompact.threads[0].resolvedBy).toBe(owner.user.id);
    expect(resolvedCompact.authors[owner.user.id].name).toBe(owner.user.name);
  });
  it("lets a configured project's owner add and remove any approved site", async () => {
    const sites = async (data?: unknown) =>
      (
        await request(
          "/project/sites",
          data ? "PATCH" : "GET",
          data,
          "owned-token",
          "shared",
          "owner/site",
          "owned"
        )
      ).json();
    expect(await sites()).toEqual({
      sites: ["https://docs.example.com", origin].sort(),
      fixed: [],
    });
    const docs = async () =>
      fetch(
        `http://localhost:${port}/config?project=owned&repo=owner/site&branch=shared`,
        { headers: { Origin: "https://docs.example.com" } }
      );
    expect((await docs()).status).toBe(200);
    expect(
      await sites({ sites: [origin, "https://*-preview.example.com"] })
    ).toEqual({
      sites: ["https://*-preview.example.com", origin].sort(),
      fixed: [],
    });
    expect((await docs()).status).toBe(403);
    const preview = await fetch(
      `http://localhost:${port}/config?project=owned&repo=owner/site&branch=shared`,
      { headers: { Origin: "https://pr-9-preview.example.com" } }
    );
    expect(preview.status).toBe(200);
    const locked = await request(
      "/project/sites",
      "PATCH",
      { sites: ["https://*-preview.example.com"] },
      "owned-token",
      "shared",
      "owner/site",
      "owned"
    );
    expect(locked.status).toBe(400);
    expect((await locked.json()).error).toBe(
      "You can’t remove the site you’re on."
    );
    await sites({ sites: [origin, "https://docs.example.com"] });
    expect((await docs()).status).toBe(200);
  });
  it("offers Google sign-in when credentials are configured", async () => {
    const config = await (await request("/config")).json();
    expect(config.google).toBe(true);
    expect((await request("/auth/google/start", "POST", {})).status).toBe(200);
    expect(
      (
        await request("/auth/google/start", "POST", {
          returnOrigin: "http://127.0.0.1:54321",
        })
      ).status
    ).toBe(200);
    expect(
      (
        await request("/auth/google/start", "POST", {
          returnOrigin: "https://evil.example",
        })
      ).status
    ).toBe(400);
  });
  it("supports two independent users, replies, reactions, resolution, and author-only editing", async () => {
    expect(
      (await request("/auth/guest", "POST", { name: "Alice", verified: true }))
        .status
    ).toBe(400);
    const alice = await (
      await request("/auth/guest", "POST", { name: "Alice" })
    ).json();
    const bob = await (
      await request("/auth/guest", "POST", { name: "Bob" })
    ).json();
    expect(alice.user.verified).toBe(false);
    const created = await request(
      "/threads",
      "POST",
      { page: "/products/workers/", anchor, body: "Increase the spacing." },
      alice.token
    );
    expect(created.status).toBe(201);
    const { id, commentId: createdCommentId } = await created.json();
    const get = async () =>
      (await (await request("/threads")).json()).threads as Thread[];
    let thread = (await get())[0];
    expect(thread.id).toBe(id);
    expect(thread.comments[0].id).toBe(createdCommentId);
    expect(thread.page).toBe("/products/workers");
    expect(thread.comments[0].author.name).toBe("Alice");
    expect(
      (
        await request(
          `/threads/${id}/comments`,
          "POST",
          { body: "Working on this." },
          bob.token
        )
      ).status
    ).toBe(201);
    thread = (await get())[0];
    expect(thread.comments).toHaveLength(2);
    const commentId = thread.comments[0].id;
    expect(
      (
        await request(
          `/threads/${id}/comments/${commentId}`,
          "PATCH",
          { body: "Forged" },
          bob.token
        )
      ).status
    ).toBe(403);
    expect(
      (
        await request(
          `/threads/${id}/comments/${commentId}`,
          "PATCH",
          { body: "Use 24px spacing." },
          alice.token
        )
      ).status
    ).toBe(200);
    for (let i = 0; i < 2; i++)
      expect(
        (
          await request(
            `/threads/${id}/comments/${commentId}/reactions`,
            "POST",
            { emoji: "👍", active: true },
            bob.token
          )
        ).status
      ).toBe(200);
    thread = (await get())[0];
    expect(thread.comments[0].body).toBe("Use 24px spacing.");
    expect(thread.comments[0].reactions["👍"]).toEqual([bob.user.id]);
    const react = (emoji: string, active: boolean, token = bob.token) =>
      request(
        `/threads/${id}/comments/${commentId}/reactions`,
        "POST",
        { emoji, active },
        token
      );
    await react("👍", true, alice.token);
    await react("❤️", true);
    thread = (await get())[0];
    expect(thread.comments[0].reactions).toEqual({
      "👍": [alice.user.id],
      "❤️": [bob.user.id],
    });
    expect((await react("👩🏽‍💻", true)).status).toBe(200);
    expect((await get())[0].comments[0].reactions).toEqual({
      "👍": [alice.user.id],
      "👩🏽‍💻": [bob.user.id],
    });
    for (const invalid of ["hello", "👍👍", "<script>", ""]) {
      expect((await react(invalid, true)).status).toBe(400);
    }
    await react("❤️", true);
    await react("❤️", false);
    expect((await get())[0].comments[0].reactions).toEqual({
      "👍": [alice.user.id],
    });
    await Promise.all([react("🎉", true), react("👀", true)]);
    const bobReactions = Object.values(
      (await get())[0].comments[0].reactions
    ).filter((users) => users.includes(bob.user.id));
    expect(bobReactions).toHaveLength(1);

    expect(
      (await request(`/threads/${id}`, "PATCH", { resolved: true }, bob.token))
        .status
    ).toBe(200);
    thread = (await get())[0];
    expect(thread.resolved).toBe(true);
    expect(thread.resolvedBy?.id).toBe(bob.user.id);
    expect(
      (await request(`/threads/${id}`, "PATCH", { resolved: false }, bob.token))
        .status
    ).toBe(200);
    expect(
      (
        await request(
          `/threads/${id}/comments/${commentId}`,
          "DELETE",
          undefined,
          alice.token
        )
      ).status
    ).toBe(200);
    thread = (await get())[0];
    expect(thread.comments).toHaveLength(2);
    expect(thread.comments[0].body).toBe("[Comment deleted]");
    expect(thread.comments[0].reactions).toEqual({});
    expect(
      (await request("/me", "DELETE", undefined, alice.token)).status
    ).toBe(200);
    expect((await request("/me", "GET", undefined, alice.token)).status).toBe(
      401
    );
  });
  it("isolates repo, project, and branch, including mutation targets", async () => {
    const user = await (
      await request("/auth/guest", "POST", { name: "Reviewer" })
    ).json();
    const threads = await (await request("/threads")).json();
    const id = threads.threads[0].id;
    expect(
      (
        await (
          await request("/threads", "GET", undefined, undefined, "feature/b")
        ).json()
      ).threads
    ).toEqual([]);
    expect(
      (
        await request(
          `/threads/${id}`,
          "PATCH",
          { resolved: true },
          user.token,
          "feature/b"
        )
      ).status
    ).toBe(404);
    expect(
      (
        await request(
          "/threads",
          "GET",
          undefined,
          undefined,
          "feature/a",
          "other/repo"
        )
      ).status
    ).toBe(403);
    expect(
      (
        await request(
          "/threads",
          "POST",
          { page: "/", anchor, body: "Wrong project" },
          user.token,
          "feature/a",
          "owner/site",
          "other"
        )
      ).status
    ).toBe(401);
  });
  it("rejects OAuth callbacks from another browser before contacting GitHub", async () => {
    const callback = await fetch(
      `http://localhost:${port}/auth/github/callback?state=untrusted&code=untrusted`,
      { headers: { Cookie: "__Host-comments-oauth=different" } }
    );
    expect(callback.status).toBe(400);
    const authorize = await fetch(
      `http://localhost:${port}/auth/github/authorize?state=expired`,
      { redirect: "manual" }
    );
    expect(authorize.status).toBe(400);
  });
  it("requires a session and rejects malicious input", async () => {
    expect(
      (
        await request("/threads", "POST", {
          page: "/",
          anchor,
          body: "Anonymous",
        })
      ).status
    ).toBe(401);
    const user = await (
      await request("/auth/guest", "POST", { name: "Validator" })
    ).json();
    expect(
      (
        await request(
          "/threads",
          "POST",
          { page: "//evil.com", anchor, body: "Bad path" },
          user.token
        )
      ).status
    ).toBe(400);
    expect(
      (
        await request(
          "/threads",
          "POST",
          { page: "/", anchor: { ...anchor, x: -1 }, body: "Bad anchor" },
          user.token
        )
      ).status
    ).toBe(400);
    expect(
      (
        await request(
          "/threads",
          "POST",
          { page: "/", anchor, body: " " },
          user.token
        )
      ).status
    ).toBe(400);
    expect(
      (
        await request(
          "/threads",
          "POST",
          { page: "/", anchor, body: "a".repeat(20000) },
          user.token
        )
      ).status
    ).toBe(413);
    const denied = await fetch(
      `http://localhost:${port}/threads?project=test&repo=owner/site&branch=feature/a`,
      { headers: { Origin: "https://evil.com" } }
    );
    expect(denied.status).toBe(403);
    expect(denied.headers.get("Access-Control-Allow-Origin")).toBeNull();
    // Any local dev port works without being listed.
    const local = await fetch(
      `http://localhost:${port}/threads?project=test&repo=owner/site&branch=feature/a`,
      { headers: { Origin: "http://localhost:8123" } }
    );
    expect(local.status).toBe(200);
    expect(local.headers.get("Access-Control-Allow-Origin")).toBe(
      "http://localhost:8123"
    );
    const refused = await fetch(
      `http://localhost:${port}/config?project=test&repo=owner/site&branch=feature/a`,
      { headers: { Origin: "https://evil.com" } }
    );
    expect(refused.status).toBe(403);
    expect(refused.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://evil.com"
    );
    expect(await refused.json()).toEqual({
      error: "This site is not approved for this komo project.",
      code: "site_not_approved",
    });
    const preflight = await fetch(
      `http://localhost:${port}/config?project=test&repo=owner/site&branch=feature/a`,
      {
        method: "OPTIONS",
        headers: {
          Origin: "https://evil.com",
          "Access-Control-Request-Method": "GET",
          "Access-Control-Request-Headers": "authorization",
        },
      }
    );
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://evil.com"
    );
    expect((await request("/auth/github/start", "POST", {})).status).toBe(503);
  });
});

describe("profile editing", () => {
  it("updates only the signed-in reviewer and persists their identity", async () => {
    const first = (await (
      await request("auth/guest", "POST", { name: "Before" })
    ).json()) as { token: string; user: { id: string } };
    const second = (await (
      await request("auth/guest", "POST", { name: "Unchanged" })
    ).json()) as { token: string };
    expect(
      (
        await request("me", "PATCH", {
          name: "After",
          avatarUrl: "https://example.com/photo.png",
        })
      ).status
    ).toBe(401);
    expect(
      (await request("me", "PATCH", { name: "", avatarUrl: "" }, first.token))
        .status
    ).toBe(400);
    expect(
      (
        await request(
          "me",
          "PATCH",
          { name: "After", avatarUrl: "javascript:alert(1)" },
          first.token
        )
      ).status
    ).toBe(400);
    expect(
      (
        await request(
          "me",
          "PATCH",
          {
            name: "After",
            avatarUrl: "https://example.com/photo.png",
          },
          first.token
        )
      ).status
    ).toBe(200);
    const saved = await (
      await request("me", "GET", undefined, first.token)
    ).json();
    expect(saved.user).toMatchObject({
      id: first.user.id,
      name: "After",
      avatarUrl: "https://example.com/photo.png",
      verified: false,
    });
    expect(
      (await (await request("me", "GET", undefined, second.token)).json()).user
        .name
    ).toBe("Unchanged");
    await request("me", "PATCH", { name: "After", avatarUrl: "" }, first.token);
    expect(
      (await (await request("me", "GET", undefined, first.token)).json()).user
        .avatarUrl
    ).toBeUndefined();
  });
});

describe("reviewer accent colors", () => {
  it("persists colors on identities and comments, rejects invalid colors, and preserves omitted colors", async () => {
    const session = await (
      await request("auth/guest", "POST", { name: "Color reviewer" })
    ).json();
    const created = await (
      await request(
        "threads",
        "POST",
        { page: "/accent", anchor, body: "Accent test" },
        session.token
      )
    ).json();
    for (const accentColor of ["red", "#abc", "#123456; color:red", 123]) {
      expect(
        (
          await request(
            "me",
            "PATCH",
            { name: "Color reviewer", avatarUrl: "", accentColor },
            session.token
          )
        ).status
      ).toBe(400);
    }
    expect(
      (
        await request(
          "me",
          "PATCH",
          { name: "Color reviewer", avatarUrl: "", accentColor: "#AABBCC" },
          session.token
        )
      ).status
    ).toBe(200);
    await request(
      "me",
      "PATCH",
      { name: "Renamed", avatarUrl: "" },
      session.token
    );
    expect(
      (await (await request("me", "GET", undefined, session.token)).json()).user
        .accentColor
    ).toBe("#aabbcc");
    const list = await (
      await request("threads", "GET", undefined, session.token)
    ).json();
    expect(
      list.threads.find((thread: Thread) => thread.id === created.id)
        .comments[0].author.accentColor
    ).toBe("#aabbcc");
  });
});

describe("workspace ownership and hosted limits", () => {
  it("reports unlimited self-hosted usage and counts only connected configured projects", async () => {
    const guest = await (
      await request("auth/guest", "POST", { name: "Usage reviewer" })
    ).json();
    const usage = await (
      await request("usage", "GET", undefined, guest.token)
    ).json();
    expect(usage.hosted).toBe(false);
    expect(usage.projects).toEqual({ used: 1, limit: null });
    expect(usage.comments.limit).toBeNull();
    expect(usage.comments.used).toBeGreaterThanOrEqual(0);
    const owned = await (
      await request(
        "usage",
        "GET",
        undefined,
        "owned-token",
        "shared",
        "owner/site",
        "owned"
      )
    ).json();
    expect(owned.projects).toEqual({ used: 2, limit: null });
    expect(owned.comments.limit).toBe(1);
  });

  it("reports private account and shared project usage, then enforces the 250 boundary", async () => {
    const usage = (token?: string) =>
      request(
        "usage",
        "GET",
        undefined,
        token,
        "shared",
        "owner/site",
        "usage-project"
      );
    expect((await usage()).status).toBe(401);
    expect(await (await usage("usage-owner-token")).json()).toEqual({
      hosted: true,
      projects: { used: 1, limit: 3 },
      comments: { used: 249, limit: 250 },
    });
    const guest = await (
      await request(
        "auth/guest",
        "POST",
        { name: "Reviewer" },
        undefined,
        "shared",
        "owner/site",
        "usage-project"
      )
    ).json();
    expect((await (await usage(guest.token)).json()).projects).toBeNull();
    const writes = await Promise.all(
      [1, 2].map((i) =>
        request(
          "threads",
          "POST",
          { body: `Last comment ${i}`, page: "/", anchor },
          "usage-owner-token",
          "shared",
          "owner/site",
          "usage-project"
        )
      )
    );
    expect(writes.map((r) => r.status).sort()).toEqual([201, 409]);
    expect((await (await usage("usage-owner-token")).json()).comments).toEqual({
      used: 250,
      limit: 250,
    });
    expect((await request("usage", "GET", undefined, guest.token)).status).toBe(
      401
    );
  });

  it("blocks guests until a Google owner claims the self-hosted workspace", async () => {
    expect(
      (
        await request(
          "auth/guest",
          "POST",
          { name: "Guest" },
          undefined,
          "shared",
          "owner/site",
          "unclaimed"
        )
      ).status
    ).toBe(403);
    expect(
      (
        await request(
          "owner/claim",
          "POST",
          { key: "test-owner-key" },
          "guest-claim-token",
          "shared",
          "owner/site",
          "unclaimed"
        )
      ).status
    ).toBe(403);
    expect(
      (
        await request(
          "owner/claim",
          "POST",
          { key: "wrong" },
          "claim-token",
          "shared",
          "owner/site",
          "unclaimed"
        )
      ).status
    ).toBe(403);
    expect(
      (
        await request(
          "owner/claim",
          "POST",
          { key: "test-owner-key" },
          "claim-token",
          "shared",
          "owner/site",
          "unclaimed"
        )
      ).status
    ).toBe(200);
    expect(
      (
        await request(
          "owner/claim",
          "POST",
          { key: "test-owner-key" },
          "claim-token",
          "shared",
          "owner/site",
          "unclaimed"
        )
      ).status
    ).toBe(409);
    expect(
      (
        await request(
          "auth/guest",
          "POST",
          { name: "Guest" },
          undefined,
          "shared",
          "owner/site",
          "unclaimed"
        )
      ).status
    ).toBe(201);
  });
  it("atomically enforces the stored comment cap", async () => {
    const results = await Promise.all(
      [1, 2].map((i) =>
        request(
          "threads",
          "POST",
          { body: `Feedback ${i}`, page: "/", anchor },
          "owned-token",
          "shared",
          "owner/site",
          "owned"
        )
      )
    );
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    const list = (await (
      await request(
        "threads",
        "GET",
        undefined,
        undefined,
        "shared",
        "owner/site",
        "owned"
      )
    ).json()) as { threads: Thread[] };
    expect(list.threads).toHaveLength(1);
  });
  it("creates hosted workspaces only for Google owners and limits projects", async () => {
    const start = async () =>
      (await (
        await request("setup/start", "POST", {
          repo: "owner/site",
          origins: [origin, "https://unverified.example"],
        })
      ).json()) as { id: string; secret: string };
    const first = await start();
    expect(
      (
        await request(
          "setup/complete",
          "POST",
          { code: first.id },
          "guest-management-token",
          "shared",
          "_komo",
          "_komo"
        )
      ).status
    ).toBe(403);
    expect(
      (await request("setup/poll", "POST", { id: first.id, secret: "wrong" }))
        .status
    ).toBe(404);
    for (let i = 0; i < 4; i++) {
      const setup = i === 0 ? first : await start();
      const result = await request(
        "setup/complete",
        "POST",
        { code: setup.id },
        "owner-token",
        "shared",
        "_komo",
        "_komo"
      );
      expect(result.status).toBe(i < 3 ? 201 : 409);
      if (i === 0) {
        const poll = (await (
          await request("setup/poll", "POST", {
            id: setup.id,
            secret: setup.secret,
          })
        ).json()) as { project: string };
        expect(poll.project).toMatch(/^komo_/);
        const reviewer = await (
          await request(
            "auth/guest",
            "POST",
            { name: "New project reviewer" },
            undefined,
            "shared",
            "owner/site",
            poll.project
          )
        ).json();
        expect(
          (
            await (
              await request(
                "usage",
                "GET",
                undefined,
                reviewer.token,
                "shared",
                "owner/site",
                poll.project
              )
            ).json()
          ).comments
        ).toEqual({ used: 0, limit: 250 });
        const api = new URL(`http://localhost:${port}/config`);
        api.searchParams.set("project", poll.project);
        expect(
          (
            await fetch(api, {
              headers: { Origin: "https://unverified.example" },
            })
          ).status
        ).toBe(403);
        const manage = (
          path: string,
          token = "owner-token",
          method = "GET",
          data?: unknown
        ) => request(path, method, data, token, "shared", "_komo", "_komo");
        expect(
          (
            await manage(
              `workspace?workspace=${poll.project}`,
              "guest-management-token"
            )
          ).status
        ).toBe(403);
        expect((await manage("workspace?workspace=usage-project")).status).toBe(
          403
        );
        expect((await manage("usage?workspace=usage-project")).status).toBe(
          403
        );
        expect((await manage(`usage?workspace=${poll.project}`)).status).toBe(
          200
        );
        expect(
          (
            await manage("workspace/sites", "guest-management-token", "POST", {
              project: poll.project,
              origin: "https://unverified.example",
            })
          ).status
        ).toBe(403);
        expect(
          (
            await manage("workspace/sites", "owner-token", "POST", {
              project: "usage-project",
              origin: "https://unverified.example",
            })
          ).status
        ).toBe(403);
        for (const invalid of [
          "http://example.com",
          "https://*.example.com",
          "https://example.com/path",
        ]) {
          expect(
            (
              await manage("workspace/sites", "owner-token", "POST", {
                project: poll.project,
                origin: invalid,
              })
            ).status
          ).toBe(400);
        }
        expect(
          (
            await manage("workspace/sites", "owner-token", "POST", {
              project: poll.project,
              origin: "https://unverified.example",
            })
          ).status
        ).toBe(200);
        expect(
          (
            await fetch(api, {
              headers: { Origin: "https://unverified.example" },
            })
          ).status
        ).toBe(200);
        expect(
          (await (await manage(`workspace?workspace=${poll.project}`)).json())
            .sites
        ).toEqual(["https://unverified.example"]);
        // Configured projects use the same approve page.
        expect(
          (
            await manage("workspace/sites", "owner-token", "POST", {
              project: "owned",
              origin: "https://approved.example",
            })
          ).status
        ).toBe(200);
        expect(
          (await (await manage("workspace?workspace=owned")).json()).sites
        ).toContain("https://approved.example");
        const sameSite = new URL(
          `http://localhost:${port}/workspace?workspace=${poll.project}&project=_komo`
        );
        expect(
          (
            await fetch(sameSite, {
              headers: {
                Authorization: "Bearer owner-token",
                "Sec-Fetch-Site": "same-origin",
              },
            })
          ).status
        ).toBe(200);
        expect(
          (
            await fetch(sameSite, {
              headers: {
                Authorization: "Bearer owner-token",
                "Sec-Fetch-Site": "cross-site",
              },
            })
          ).status
        ).toBe(403);
        expect(
          (
            await request(
              "setup/complete",
              "POST",
              { code: setup.id },
              "owner-token",
              "shared",
              "_komo",
              "_komo"
            )
          ).status
        ).toBe(409);
      }
    }
  });
});

it("runs the agent CLI against the real Worker and persisted threads", async () => {
  const session = await (
    await request(
      "/auth/guest",
      "POST",
      { name: "CLI fixture" },
      undefined,
      "shared",
      "owner/site",
      "cli"
    )
  ).json();
  const cliRoot = join(directory, "cli-project");
  const { mkdir } = await import("node:fs/promises");
  await mkdir(join(cliRoot, ".komo"), { recursive: true });
  await mkdir(join(cliRoot, "nested"));
  await writeFile(
    join(cliRoot, ".komo/project.json"),
    JSON.stringify({
      project: "cli",
      endpoint: `http://localhost:${port}`,
      origin,
      repo: "owner/site",
      scope: "project",
    })
  );
  await writeFile(join(cliRoot, "anchor.json"), JSON.stringify(anchor));
  const cli = async (...args: string[]) => {
    const result = await promisify(execFile)(
      process.execPath,
      [join(root, "packages/komo/cli/index.mjs"), ...args],
      {
        cwd: join(cliRoot, "nested"),
        env: {
          ...process.env,
          KOMO_TOKEN: session.token,
          KOMO_CONFIG_HOME: join(directory, "credentials"),
          KOMO_BRANCH: "shared",
        },
      }
    );
    return JSON.parse(result.stdout);
  };
  const created = await cli(
    "comments",
    "create",
    "--page",
    "/cli",
    "--anchor-file",
    "../anchor.json",
    "--body",
    "Make the hero clearer."
  );
  const threadId = created.data.id;
  expect(created.scope.branch).toBe("shared");
  const listing = await cli("comments", "list", "--page", "/cli");
  expect(listing.data.threads.map((thread: Thread) => thread.id)).toContain(
    threadId
  );
  const reply = await cli(
    "comments",
    "reply",
    threadId,
    "--body",
    "Fixed and checked."
  );
  await cli(
    "comments",
    "edit",
    threadId,
    reply.data.id,
    "--body",
    "Fixed and checked on mobile."
  );
  await cli("comments", "react", threadId, reply.data.id, "--emoji", "👍");
  const prompt = await cli("comments", "prompt", "--page", "/cli", "--json");
  expect(prompt.data.prompt).toContain("Fixed and checked on mobile.");
  expect(prompt.data.prompt).toContain('Scope: "/cli"');
  await cli("comments", "resolve", threadId);
  expect((await cli("comments", "list")).data.threads).toHaveLength(0);
  expect((await cli("comments", "prompt", "--json")).data.prompt).toBe(
    "No open comments."
  );
  await cli("comments", "reopen", threadId);
  await cli("comments", "move", threadId, "--anchor-file", "../anchor.json");
  expect((await cli("comments", "get", threadId)).data.anchor.unstacked).toBe(
    true
  );
  await cli("comments", "delete", threadId, reply.data.id);
  expect(
    (await cli("comments", "get", threadId)).data.comments.find(
      (comment: { id: string; body: string }) => comment.id === reply.data.id
    )?.body
  ).toBeUndefined();
});

describe("owner management and private projects", () => {
  const call = (
    path: string,
    method = "GET",
    data?: unknown,
    token = "managed-owner",
    project = "managed"
  ) => request(path, method, data, token, "shared", "owner/site", project);
  it("enforces invitations, rejects other emails and revokes existing sessions", async () => {
    expect(
      (await call("/project", "GET", undefined, "managed-stranger")).status
    ).toBe(403);
    expect(
      (await call("/project", "PATCH", { access: "private" })).status
    ).toBe(200);
    expect((await call("/threads", "GET", undefined, "")).status).toBe(401);
    expect(
      (await call("/threads", "GET", undefined, "managed-stranger")).status
    ).toBe(403);
    expect(
      (await call("/usage", "GET", undefined, "managed-stranger")).status
    ).toBe(403);
    expect(
      (await call("/auth/guest", "POST", { name: "Guest" }, "")).status
    ).toBe(403);
    expect((await call("/threads")).status).toBe(200);
    const invitation = await (
      await call("/project/invites", "POST", { email: "member@example.com" })
    ).json();
    expect(invitation.url).toContain("#invite=");
    expect(
      (
        await call(
          "/project/join",
          "POST",
          { invite: invitation.invite },
          "managed-stranger"
        )
      ).status
    ).toBe(403);
    expect(
      (
        await call(
          "/project/join",
          "POST",
          { invite: invitation.invite },
          "managed-member"
        )
      ).status
    ).toBe(200);
    expect(
      (
        await call(
          "/project/join",
          "POST",
          { invite: invitation.invite },
          "managed-member"
        )
      ).status
    ).toBe(403);
    expect(
      (await call("/threads", "GET", undefined, "managed-member")).status
    ).toBe(200);
    expect(
      (await call("/project/export", "GET", undefined, "managed-member")).status
    ).toBe(403);
    expect(
      (await call("/project/members", "DELETE", { user: "google:member" }))
        .status
    ).toBe(200);
    expect(
      (await call("/threads", "GET", undefined, "managed-member")).status
    ).toBe(401);
    expect((await call("/project", "PATCH", { access: "public" })).status).toBe(
      200
    );
    expect((await call("/threads", "GET", undefined, "")).status).toBe(200);
  });
  it("exports and imports scoped feedback without credentials or verified identities, and frees quota", async () => {
    const created = await (
      await call("/threads", "POST", {
        page: "/",
        anchor,
        body: "Move this feedback",
      })
    ).json();
    expect(
      (
        await call(`/threads/${created.id}/comments`, "POST", {
          body: "Include my reply",
        })
      ).status
    ).toBe(201);
    await call(`/threads/${created.id}`, "PATCH", { resolved: true });
    const snapshot = await (await call("/project/export?table=threads")).json();
    await call(`/threads/${created.id}/comments`, "POST", {
      body: "New feedback during export",
    });
    expect(
      (
        await call(
          `/project/export?table=comments&revision=${snapshot.revision}`
        )
      ).status
    ).toBe(409);
    const tables: Record<string, unknown[]> = {};
    for (const kind of ["users", "threads", "comments", "reactions"]) {
      const response = await call(`/project/export?table=${kind}`);
      expect(response.status).toBe(200);
      tables[kind] = (await response.json()).rows;
      expect(JSON.stringify(tables[kind])).not.toMatch(
        /token_hash|owner@example.com|expires_at/
      );
      if (!tables[kind].length) continue;
      const imported = await call(
        "/project/import",
        "POST",
        { source: "managed", kind, records: tables[kind] },
        "destination-owner",
        "destination"
      );
      expect(imported.status).toBe(200);
      expect((await imported.json()).imported).toBe(tables[kind].length);
      const retry = await (
        await call(
          "/project/import",
          "POST",
          { source: "managed", kind, records: tables[kind] },
          "destination-owner",
          "destination"
        )
      ).json();
      expect(retry.imported).toBe(0);
    }
    const result = await (
      await call(
        "/threads",
        "GET",
        undefined,
        "destination-owner",
        "destination"
      )
    ).json();
    expect(result.threads).toHaveLength(1);
    expect(
      result.threads[0].comments.map((c: { body: string }) => c.body)
    ).toEqual([
      "Move this feedback",
      "Include my reply",
      "New feedback during export",
    ]);
    expect(result.threads[0].comments[0].author.verified).toBe(false);
    const imported = result.threads[0];
    expect(imported.id).toMatch(/^import:/);
    const cliRead = await promisify(execFile)(process.execPath,
      [join(root, "packages/komo/cli/index.mjs"), "comments", "get", imported.id],
      {cwd: directory, env: {...process.env, KOMO_ENDPOINT: `http://localhost:${port}`, KOMO_PROJECT: "destination", KOMO_REPO: "owner/site", KOMO_BRANCH: "shared", KOMO_ORIGIN: origin, KOMO_TOKEN: "destination-owner"}});
    expect(JSON.parse(cliRead.stdout).data.id).toBe(imported.id);
    const mutateImported = (path: string, method: string, data: unknown) =>
      call(path, method, data, "destination-owner", "destination");
    expect((await mutateImported(`/threads/${imported.id}`, "PATCH", {resolved: false})).status).toBe(200);
    expect((await mutateImported(`/threads/${imported.id}`, "PATCH", {anchor: {...anchor, x: 0.4}})).status).toBe(200);
    expect((await mutateImported(`/threads/${imported.id}/comments`, "POST", {body: "Reply after import"})).status).toBe(201);
    const importedComment = `/threads/${imported.id}/comments/${imported.comments[0].id}`;
    expect((await mutateImported(`${importedComment}/reactions`, "POST", {emoji: "👍", active: true})).status).toBe(200);
    // Import never grants ownership of the historical author's messages.
    expect((await mutateImported(importedComment, "PATCH", {body: "Not mine"})).status).toBe(403);
    expect((await call(`/threads/${imported.id}`, "PATCH", {resolved: true})).status).toBe(404);
    expect((await request(`/threads/${imported.id}`, "PATCH", {resolved: true}, "destination-owner", "other", "owner/site", "destination")).status).toBe(404);

    expect(
      (await call("/project/clear-resolved", "POST", { confirm: "wrong" }))
        .status
    ).toBe(400);
    expect(
      (await call("/project/clear-resolved", "POST", { confirm: "managed" }))
        .status
    ).toBe(200);
    expect((await (await call("/usage")).json()).comments.used).toBe(0);
    expect(
      (
        await (
          await call(
            "/threads",
            "GET",
            undefined,
            "destination-owner",
            "destination"
          )
        ).json()
      ).threads
    ).toHaveLength(1);
  });
  it("cleans only selected resolved threads, preserving open and other-project feedback", async () => {
    const create = async (body: string) =>
      (
        await (
          await call("/threads", "POST", { page: "/cleanup", anchor, body })
        ).json()
      ).id;
    const chosen = await create("Delete this resolved thread");
    const other = await create("Keep this resolved thread");
    const open = await create("Keep this open thread");
    await call(`/threads/${chosen}`, "PATCH", { resolved: true });
    await call(`/threads/${other}`, "PATCH", { resolved: true });
    const destination = (
      await (
        await call(
          "/threads",
          "GET",
          undefined,
          "destination-owner",
          "destination"
        )
      ).json()
    ).threads[0].id;
    const data = { confirm: "managed", threadIds: [chosen, open, destination] };
    expect(
      (await call("/project/clear-resolved", "POST", data, "managed-stranger"))
        .status
    ).toBe(403);
    expect(
      (
        await call("/project/clear-resolved", "POST", {
          confirm: "managed",
          threadIds: [],
        })
      ).status
    ).toBe(400);
    const result = await (
      await call("/project/clear-resolved", "POST", data)
    ).json();
    expect(result.deleted).toBe(1);
    const remaining = (await (await call("/threads")).json()).threads.map(
      (t: { id: string }) => t.id
    );
    expect(remaining).toContain(open);
    expect(remaining).toContain(other);
    expect(remaining).not.toContain(chosen);
    expect(
      (
        await (
          await call(
            "/threads",
            "GET",
            undefined,
            "destination-owner",
            "destination"
          )
        ).json()
      ).threads
    ).toHaveLength(1);
  });
  it("deletes only the confirmed owned workspace and restores its owner slot", async () => {
    expect(
      (await call("/project", "DELETE", { confirm: "destination" })).status
    ).toBe(400);
    expect(
      (
        await call(
          "/project",
          "DELETE",
          { confirm: "destination" },
          "destination-owner",
          "destination"
        )
      ).status
    ).toBe(200);
    expect(
      (await call("/config", "GET", undefined, "", "destination")).status
    ).toBe(404);
    expect((await call("/config")).status).toBe(200);
    const usage = await (await call("/usage")).json();
    expect(usage.projects.used).toBe(1);
  });
});

it("paginates tied timestamps with scoped cursors while preserving offset clients", async () => {
  const read = async (query: string, branch = "pagination") =>
    (await request(`/threads?${query}`, "GET", undefined, undefined, branch)).json();
  const first = await read("authors=1");
  expect(first.threads).toHaveLength(50);
  expect(JSON.parse(first.nextCursor)).toEqual([100, "import:050"]);
  const query = `cursor=${encodeURIComponent(first.nextCursor)}`;
  const next = await read(`${query}&revision=${first.revision}&authors=1`);
  expect(next.threads).toHaveLength(15);
  expect(next.nextCursor).toBeNull();
  const legacy = await read("offset=50&authors=1");
  expect(next.threads).toEqual(legacy.threads);
  expect(new Set([...first.threads, ...next.threads].map(t => t.id)).size).toBe(65);
  expect((await read(query, "no-such-branch")).threads).toEqual([]);
  expect((await read(`revision=${first.revision}`)).notModified).toBe(true);
  for (const cursor of ["bad", "[]", '[1,{}]', '[null,"id"]'])
    expect((await request(`/threads?cursor=${encodeURIComponent(cursor)}`, "GET", undefined, undefined, "pagination")).status).toBe(400);
});
