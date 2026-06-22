// READ-ONLY: report dev@hearst.local role in whatever DB env points at.
import { loadProjectEnv } from "../lib/load-env.mjs";
loadProjectEnv(process.cwd());
const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
const prov = process.env.PRISMA_PROVIDER ?? (url.startsWith("postgres") ? "postgresql" : "sqlite");
const host = (() => { try { return new URL(url).host; } catch { return url; } })();
console.log(JSON.stringify({ provider: prov, host }));
