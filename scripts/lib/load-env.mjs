/**
 * Minimal .env loader for Node scripts (no dotenv dependency).
 * Mirrors Next.js precedence: .env then .env.local (local wins).
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function parseEnvFile(path) {
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    // Don't override vars already set in the process env — lets the caller
    // (e.g. Playwright webServer.env) take precedence over .env files.
    if (!(key in process.env)) process.env[key] = value;
  }
}

export function loadProjectEnv(root = process.cwd()) {
  parseEnvFile(resolve(root, ".env"));
  parseEnvFile(resolve(root, ".env.local"));
}
