import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * FRONTEND-API-ONLY ARCHITECTURE GUARD (PROMPT 218).
 *
 * Invariant: the browser never talks to the chain, the DB, or an external
 * business provider. All business reads live behind the SERVER surface
 * (Server Components + route handlers + `src/lib/chain/dynavault.ts`, which is
 * `server-only`). A `"use client"` module must never pull viem/wagmi/ethers,
 * Prisma, the chain adapter, or an external data provider into a client bundle —
 * that would let the frontend bypass the server surface.
 *
 * This guard freezes that decision. It is a static, AST-free scan (the same
 * robust substring approach the DS guards use). If it fails, a client module
 * has acquired a forbidden business dependency, OR a load-bearing server module
 * lost its `server-only` marker.
 *
 * Documented exception (§19): wallet CONNECTION + LOCAL SIGNING of a
 * server-prepared transaction is allowed in client code (wagmi/viem *wallet*
 * clients), but never a business READ. No such client exists yet; when one is
 * added, narrow the allowlist below to that file only.
 */

const ROOT = process.cwd();
const SRC = join(ROOT, "src");

/** Recursively collect .ts/.tsx files under src, skipping tests & generated. */
function collectSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === "__tests__" || entry === "node_modules") continue;
      out.push(...collectSourceFiles(full));
      continue;
    }
    if (!/\.(ts|tsx)$/.test(entry)) continue;
    if (entry.endsWith(".d.ts")) continue;
    out.push(full);
  }
  return out;
}

const ALL_FILES = collectSourceFiles(SRC);

/** A file is "client" iff its first non-empty line is a "use client" directive. */
function isClientModule(source: string): boolean {
  const firstCode = source
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  return firstCode === '"use client";' || firstCode === "'use client';";
}

const CLIENT_FILES = ALL_FILES.filter((f) => isClientModule(readFileSync(f, "utf8")));

// Imports a client module must NEVER contain — each would let the browser reach
// a business source directly, bypassing the server surface.
const FORBIDDEN_CLIENT_IMPORTS: ReadonlyArray<{ pattern: RegExp; why: string }> = [
  { pattern: /from\s+['"]viem['"]/, why: "viem — chain reads belong on the server" },
  { pattern: /from\s+['"]viem\//, why: "viem subpath — chain reads belong on the server" },
  { pattern: /from\s+['"]wagmi['"]/, why: "wagmi contract reads — server only" },
  { pattern: /from\s+['"]ethers['"]/, why: "ethers — chain reads belong on the server" },
  { pattern: /from\s+['"]web3['"]/, why: "web3 — chain reads belong on the server" },
  { pattern: /from\s+['"]@prisma\/client['"]/, why: "Prisma in a client bundle" },
  { pattern: /from\s+['"]@\/lib\/db['"]/, why: "DB client in a client bundle" },
  { pattern: /from\s+['"]@\/lib\/prisma['"]/, why: "Prisma in a client bundle" },
  { pattern: /from\s+['"]@\/lib\/chain\/dynavault['"]/, why: "chain adapter in a client bundle" },
  { pattern: /from\s+['"]@\/lib\/chain\/keeper['"]/, why: "keeper (signs tx) in a client bundle" },
  {
    pattern: /from\s+['"]@\/lib\/data\/(binance-price|antpool|market-prices|stablecoin-prices|btc-price)['"]/,
    why: "external market/mining provider in a client bundle",
  },
  { pattern: /createPublicClient|readContract|watchContractEvent|getLogs/, why: "raw chain read call in client code" },
];

// Load-bearing server modules that MUST carry the `server-only` marker so the
// build fails loudly if they ever get pulled client-side.
const MUST_BE_SERVER_ONLY = [
  "src/lib/chain/dynavault.ts",
  "src/lib/chain/keeper.ts",
  "src/lib/db.ts",
] as const;

describe("frontend-api-only architecture guard", () => {
  it("has client modules to check (sanity)", () => {
    expect(CLIENT_FILES.length).toBeGreaterThan(0);
  });

  it("no client module imports the chain, the DB, or an external provider", () => {
    const violations: string[] = [];
    for (const file of CLIENT_FILES) {
      // Strip `import type … from …` lines: they are erased at compile time
      // (verbatimModuleSyntax), so a type-only Prisma/chain reference never
      // reaches the client bundle. Only VALUE imports are a runtime leak.
      const source = readFileSync(file, "utf8")
        .split("\n")
        .filter((line) => !/^\s*import\s+type\s/.test(line))
        .join("\n");
      for (const { pattern, why } of FORBIDDEN_CLIENT_IMPORTS) {
        if (pattern.test(source)) {
          violations.push(`${relative(ROOT, file)} → ${why} (matched ${pattern})`);
        }
      }
    }
    expect(violations, `client modules must go through the server surface:\n${violations.join("\n")}`).toEqual([]);
  });

  it("load-bearing server modules keep their server-only marker", () => {
    const missing: string[] = [];
    for (const rel of MUST_BE_SERVER_ONLY) {
      const source = readFileSync(join(ROOT, rel), "utf8");
      if (!/import\s+['"]server-only['"]/.test(source)) missing.push(rel);
    }
    expect(missing, `these must import "server-only":\n${missing.join("\n")}`).toEqual([]);
  });
});
