#!/usr/bin/env node
/**
 * Driver for the MASSIVE deterministic regex stress loop over the nav fallback
 * resolvers (resolveLpNavDestinationKey / resolveAdminNavFallbackKey).
 *
 * The resolvers are TS with "@/..." path aliases, so they cannot be imported
 * from a plain .mjs. The actual loop lives in a Vitest test
 * (src/lib/llm/__tests__/stress-nav-corpus.test.ts) which gets the @ alias +
 * TS transpile for free. This driver just runs that test, captures stdout,
 * parses the emitted `STRESS_RESULT {...}` JSON line, and re-prints it.
 *
 * Pure regex, no LLM, no network — CI-safe and free.
 *
 * Usage:
 *   node scripts/stress/stress-nav-regex.mjs
 */

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..", "..");
const testFile = "src/lib/llm/__tests__/stress-nav-corpus.test.ts";

const res = spawnSync("pnpm", ["test", testFile], {
  cwd: projectRoot,
  encoding: "utf8",
  env: process.env,
});

const stdout = res.stdout ?? "";
const stderr = res.stderr ?? "";
const combined = stdout + "\n" + stderr;

// Surface the raw vitest output so failures are visible verbatim.
process.stdout.write(combined);

const line = combined
  .split("\n")
  .find((l) => l.includes("STRESS_RESULT "));

if (!line) {
  process.stderr.write(
    "\n[stress-nav-regex] No STRESS_RESULT line found. Test likely failed.\n",
  );
  process.exit(res.status ?? 1);
}

const json = line.slice(line.indexOf("STRESS_RESULT ") + "STRESS_RESULT ".length);
let parsed;
try {
  parsed = JSON.parse(json);
} catch (err) {
  process.stderr.write(`\n[stress-nav-regex] Failed to parse JSON: ${err}\n`);
  process.exit(1);
}

process.stdout.write("\n[stress-nav-regex] PARSED RESULT:\n");
process.stdout.write(JSON.stringify(parsed, null, 2) + "\n");
process.stdout.write(`\n[stress-nav-regex] vitest exit code: ${res.status}\n`);

process.exit(res.status ?? 0);
