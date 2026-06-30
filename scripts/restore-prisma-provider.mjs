/**
 * scripts/restore-prisma-provider.mjs
 *
 * Restore the shared Prisma schema + client to the LOCKED provider (postgresql),
 * unconditionally. Runs in a `finally` after the test suite so a crashed/killed
 * `vitest` can NEVER leave the schema/client on sqlite — which silently points the
 * live dev server at the local dev.db (wrong accounts → "can't log in").
 *
 * This is the safety net for the recurring footgun: `pretest` flips the shared
 * client to sqlite, and the standard npm `posttest` only runs on test SUCCESS.
 */

import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { loadProjectEnv } from "./lib/load-env.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
loadProjectEnv(resolve(__dirname, ".."));

// Honour the lock if set, else fall back to postgresql (the live dev default).
const target = process.env.PRISMA_PROVIDER_LOCK?.trim() || "postgresql";

const env = { ...process.env, PRISMA_PROVIDER: target };

console.log(`[restore-prisma-provider] restoring shared schema + client to "${target}"…`);

const swap = spawnSync("node", [resolve(__dirname, "prisma-provider.mjs")], {
  stdio: "inherit",
  env,
});
if (swap.status !== 0) process.exit(swap.status ?? 1);

const gen = spawnSync("npx", ["prisma", "generate"], {
  stdio: "inherit",
  env,
});
process.exit(gen.status ?? 0);
