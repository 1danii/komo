import { spawn } from "node:child_process";
import { writeFile, symlink } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { Pool } from "pg";
import { postgresDatabase } from "../server/postgres";

/** Run the existing HTTP contract suite against an isolated PostgreSQL schema. */
export async function startPostgresApiFixture(options: {
  connection: string;
  directory: string;
  seed: string;
  vars: Record<string, string>;
  port: number;
  workerPath: string;
}) {
  const schema = `komo_api_${crypto.randomUUID().replaceAll("-", "")}`;
  const admin = new Pool({ connectionString: options.connection });
  const url = new URL(options.connection);
  url.searchParams.set("options", `-c search_path=${schema}`);
  await admin.query(`CREATE SCHEMA ${schema}`);
  const db = postgresDatabase(url.href);
  const seedPool = new Pool({ connectionString: url.href });
  const dispose = async () => {
    await db.close();
    await seedPool.end();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
  };
  try {
    await db.migrate();
    await seedPool.query(options.seed);
    const runtime = join(options.directory, "postgres-api.mjs");
    await symlink(
      fileURLToPath(new URL("../node_modules", import.meta.url)),
      join(options.directory, "node_modules"),
      "dir",
    );
    await build({
      stdin: {
        contents: `
        import {createServer} from 'node:http';
        import {Readable} from 'node:stream';
        import api from ${JSON.stringify(options.workerPath)};
        import {postgresDatabase} from ${JSON.stringify(fileURLToPath(new URL("../server/postgres.ts", import.meta.url)))};
        const db=postgresDatabase(process.env.KOMO_FIXTURE_DATABASE_URL);
        const env={...JSON.parse(process.env.KOMO_FIXTURE_VARS),DB:db};
        const server=createServer(async(incoming,outgoing)=>{
          try {
            const headers=new Headers();
            for(const [key,value]of Object.entries(incoming.headers)) if(value!==undefined) headers.set(key,Array.isArray(value)?value.join(','):value);
            headers.set('CF-Connecting-IP','127.0.0.1');
            const request=new Request('http://localhost:'+process.env.KOMO_FIXTURE_PORT+incoming.url,{
              method:incoming.method,headers,
              body:['GET','HEAD'].includes(incoming.method)?undefined:Readable.toWeb(incoming),duplex:'half',
            });
            const response=await api.fetch(request,env,{waitUntil:task=>void task.catch(console.error)});
            outgoing.writeHead(response.status,Object.fromEntries(response.headers));
            if(response.body)Readable.fromWeb(response.body).pipe(outgoing);else outgoing.end();
          }catch(error){console.error(error);outgoing.writeHead(500);outgoing.end();}
        });
        server.listen(Number(process.env.KOMO_FIXTURE_PORT),'127.0.0.1');
        process.on('SIGTERM',()=>server.close(()=>void db.close().then(()=>process.exit())));
      `,
        resolveDir: options.directory,
        loader: "ts",
      },
      bundle: true,
      platform: "node",
      format: "esm",
      packages: "external",
      loader: { ".txt": "text" },
      outfile: runtime,
    });
    const processHandle = spawn(process.execPath, [runtime], {
      env: {
        ...process.env,
        KOMO_FIXTURE_DATABASE_URL: url.href,
        KOMO_FIXTURE_VARS: JSON.stringify(options.vars),
        KOMO_FIXTURE_PORT: String(options.port),
      },
      stdio: ["ignore", "pipe", "pipe"],
      detached: true,
    });
    return { process: processHandle, dispose };
  } catch (error) {
    await dispose();
    throw error;
  }
}
