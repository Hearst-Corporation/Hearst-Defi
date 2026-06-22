import { readFileSync } from "fs";
const url = readFileSync(".env.local","utf8").match(/DATABASE_URL="([^"]+)"/)[1];
const { Client } = await import("pg");
const c = new Client({ connectionString: url });
await c.connect();
const r = await c.query(`SELECT model, COUNT(*)::int AS n, MAX("createdAt") AS last FROM "LlmRun" WHERE "agentName"='cockpit-chat' GROUP BY model ORDER BY last DESC LIMIT 5`);
for (const row of r.rows) console.log("  model="+row.model+"  count="+row.n+"  last="+row.last.toISOString());
await c.end();
