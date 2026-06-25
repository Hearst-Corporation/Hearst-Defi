/**
 * scripts/assert-prisma-provider-safe.mjs
 *
 * WHY THIS EXISTS — the worktree clobber hazard:
 * pnpm dedups identical dependency closures into a single content-addressed store
 * entry, so every git worktree's `node_modules/@prisma/client` is a symlink into
 * the SAME `.pnpm/@prisma+client@<hash>/…` directory. `prisma generate` writes the
 * generated runtime INTO that shared directory. The provider is baked into the
 * generated client (sqlite vs postgresql), so a `PRISMA_PROVIDER=sqlite prisma
 * generate` run from one worktree (e.g. the `pretest` hook of `pnpm test`)
 * silently overwrites the postgres client a live `pnpm dev` server in ANOTHER
 * worktree is using → that server starts throwing "Driver Adapter @prisma/adapter-pg
 * is not compatible with the provider `sqlite`". This happened twice during the
 * performance lots.
 *
 * THE GUARD:
 * Generating the POSTGRES client is always safe (it's the prod/default provider —
 * it cannot break a postgres consumer). The danger is only a SQLITE generate while
 * a postgres dev server is live. So this guard REFUSES a sqlite generate when a
 * local dev server appears active, unless an explicit isolation override is set
 * (CI, or PRISMA_SQLITE_ISOLATED=1 for a knowingly-isolated environment).
 *
 * USAGE (called before any sqlite generate):
 *   node scripts/assert-prisma-provider-safe.mjs sqlite      # explicit target
 *   node scripts/assert-prisma-provider-safe.mjs             # target from env
 *
 * Exit 0 → safe to proceed. Exit 1 → refused (clear message printed).
 *
 * Overrides that make a sqlite generate allowed even with a live server:
 *   CI=1                      (CI runners get a clean, isolated node_modules)
 *   PRISMA_SQLITE_ISOLATED=1  (you guarantee no shared postgres consumer is live)
 *
 * Tunables:
 *   HEARST_DEV_PORT / PORT    dev port to probe for a live server (default 4105)
 */

import net from "node:net";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { loadProjectEnv } from "./lib/load-env.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
loadProjectEnv(resolve(__dirname, ".."));

const DEFAULT_DEV_PORT = 4105;

/**
 * Pure decision helper — exported for unit testing. No I/O.
 *
 * @param {object} input
 * @param {"sqlite"|"postgresql"} input.requested  provider about to be generated
 * @param {boolean} input.devServerActive          a local dev server is listening
 * @param {boolean} input.overrideIsolated         CI or PRISMA_SQLITE_ISOLATED set
 * @returns {{ safe: boolean, reason: string }}
 */
export function evaluateProviderSafety({ requested, devServerActive, overrideIsolated }) {
  if (requested === "postgresql") {
    return {
      safe: true,
      reason: "postgresql generate is always safe (prod/default provider).",
    };
  }
  if (requested !== "sqlite") {
    // Unknown providers are not our concern — let downstream tools validate.
    return { safe: true, reason: `provider "${requested}" is not gated.` };
  }
  if (overrideIsolated) {
    return {
      safe: true,
      reason:
        "sqlite generate allowed — isolation override set (CI / PRISMA_SQLITE_ISOLATED).",
    };
  }
  if (devServerActive) {
    return {
      safe: false,
      reason:
        "refusing sqlite generate while a local dev server appears active — it would " +
        "overwrite the shared Prisma client and break that (postgres) server.",
    };
  }
  return {
    safe: true,
    reason: "no live dev server detected — sqlite generate is safe.",
  };
}

/** Resolve the provider this run is about to generate (arg → env → DATABASE_URL). */
export function resolveRequestedProvider(argv, env) {
  const arg = argv?.[2]?.trim();
  if (arg === "sqlite" || arg === "postgresql") return arg;
  const explicit = env.PRISMA_PROVIDER?.trim();
  if (explicit === "sqlite" || explicit === "postgresql") return explicit;
  const url = env.DATABASE_URL?.trim() ?? "file:./prisma/dev.db";
  return url.startsWith("postgres://") || url.startsWith("postgresql://")
    ? "postgresql"
    : "sqlite";
}

/** True when CI or an explicit isolation override is set. */
export function hasIsolationOverride(env) {
  return (
    !!env.CI ||
    env.PRISMA_SQLITE_ISOLATED === "1" ||
    env.PRISMA_SQLITE_ISOLATED === "true"
  );
}

/** Probe a single TCP port on localhost for a listener. Resolves boolean. */
function portIsOpen(port, timeoutMs = 400) {
  return new Promise((resolvePromise) => {
    const socket = new net.Socket();
    let settled = false;
    const done = (open) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolvePromise(open);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
    socket.connect(port, "127.0.0.1");
  });
}

async function main() {
  const requested = resolveRequestedProvider(process.argv, process.env);
  const overrideIsolated = hasIsolationOverride(process.env);

  // Only pay the port-probe cost when it can matter (sqlite, no override).
  let devServerActive = false;
  if (requested === "sqlite" && !overrideIsolated) {
    const devPort = Number(
      process.env.HEARST_DEV_PORT || process.env.PORT || DEFAULT_DEV_PORT,
    );
    devServerActive = await portIsOpen(devPort);
    if (devServerActive) {
      console.error(
        `[prisma-provider] a local dev server is listening on :${devPort}.`,
      );
    }
  }

  const { safe, reason } = evaluateProviderSafety({
    requested,
    devServerActive,
    overrideIsolated,
  });

  if (safe) {
    console.log(`[prisma-provider] OK (${requested}) — ${reason}`);
    process.exit(0);
  }

  console.error(`[prisma-provider] REFUSED (${requested}) — ${reason}`);
  console.error(
    "[prisma-provider] use PRISMA_PROVIDER=postgresql for dev, or stop the dev " +
      "server before running sqlite tests, or run them isolated with " +
      "PRISMA_SQLITE_ISOLATED=1 (CI sets this implicitly). See " +
      "docs/dev/PRISMA_WORKTREE_ISOLATION.md.",
  );
  process.exit(1);
}

// Only run the CLI when invoked directly (not when imported by tests).
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main();
}
