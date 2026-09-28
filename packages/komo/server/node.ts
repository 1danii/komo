import { createServer } from "node:http";
import { Readable } from "node:stream";
import { isIP } from "node:net";
import { postgresDatabase } from "./postgres";
import worker from "./index";
import { sitePattern } from "./validation";

const databaseUrl = process.env.DATABASE_URL;
const projects = process.env.PROJECTS;
const publicUrl = process.env.PUBLIC_URL;
if (!databaseUrl || !projects || !publicUrl)
  throw Error("DATABASE_URL, PUBLIC_URL, and PROJECTS are required");
const origin = new URL(publicUrl);
if (
  origin.origin !== publicUrl ||
  (origin.protocol !== "https:" &&
    !["localhost", "127.0.0.1"].includes(origin.hostname))
)
  throw Error(
    "PUBLIC_URL must be an HTTPS origin (or localhost for development)",
  );
const configured = JSON.parse(projects) as Record<
  string,
  { repo?: unknown; origins?: unknown }
>;
if (
  !configured ||
  typeof configured !== "object" ||
  Array.isArray(configured) ||
  Object.values(configured).some(
    (project) =>
      !project ||
      typeof project.repo !== "string" ||
      !Array.isArray(project.origins) ||
      project.origins.some(
        (site) => typeof site !== "string" || sitePattern(site) !== site,
      ),
  )
) {
  throw Error("PROJECTS must map project keys to repo and origins");
}
const db = postgresDatabase(databaseUrl);
await db.migrate();
const env = {
  DB: db,
  PROJECTS: projects,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ?? "",
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ?? "",
  GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID ?? "",
  GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET ?? "",
} as unknown as Env;
const port = Number(process.env.PORT ?? 8080);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw Error("Invalid PORT");
const server = createServer(async (incoming, outgoing) => {
  try {
    const url = new URL(incoming.url ?? "/", publicUrl);
    if (url.origin !== publicUrl) {
      outgoing.writeHead(400);
      outgoing.end();
      return;
    }
    const headers = new Headers();
    for (const [name, value] of Object.entries(incoming.headers)) {
      if (value !== undefined)
        headers.set(name, Array.isArray(value) ? value.join(", ") : value);
    }
    // Ignore client-supplied Cloudflare IP headers. The API uses this trusted value for rate limits.
    const proxyHops = Number(process.env.KOMO_PROXY_HOPS ?? 0);
    if (!Number.isInteger(proxyHops) || proxyHops < 0 || proxyHops > 8)
      throw Error("Invalid KOMO_PROXY_HOPS");
    const forwardedHeader = incoming.headers["x-forwarded-for"];
    const forwarded = (
      Array.isArray(forwardedHeader)
        ? forwardedHeader.join(",")
        : (forwardedHeader ?? "")
    )
      .split(",")
      .map((ip) => ip.trim());
    const ip =
      proxyHops > 0 ? forwarded.at(-proxyHops) : incoming.socket.remoteAddress;
    headers.set(
      "CF-Connecting-IP",
      ip && isIP(ip) ? ip : (incoming.socket.remoteAddress ?? "local"),
    );
    const request = new Request(url, {
      method: incoming.method,
      headers,
      body: ["GET", "HEAD"].includes(incoming.method ?? "GET")
        ? undefined
        : (Readable.toWeb(incoming) as ReadableStream),
      duplex: "half",
    } as RequestInit);
    const pending: Promise<unknown>[] = [];
    const context = {
      waitUntil(task: Promise<unknown>) {
        pending.push(
          task.catch((error) => console.error("background_task_failed", error)),
        );
      },
    };
    const response = await worker.fetch(
      request as unknown as Parameters<typeof worker.fetch>[0],
      env,
      context as unknown as ExecutionContext,
    );
    outgoing.writeHead(response.status, Object.fromEntries(response.headers));
    if (response.body) Readable.fromWeb(response.body as never).pipe(outgoing);
    else outgoing.end();
    void Promise.all(pending);
  } catch (error) {
    console.error("node_request_failed", error);
    if (!outgoing.headersSent) outgoing.writeHead(500);
    outgoing.end();
  }
});
server.listen(port, "0.0.0.0", () =>
  console.log(`komo API listening on ${port}`),
);
process.on("SIGTERM", () => server.close(() => void db.close()));
process.on("SIGINT", () => server.close(() => void db.close()));
