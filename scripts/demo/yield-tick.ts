/**
 * Demo lever: "yield tick" — bump one investor's accrued yield live during a
 * demo, so the portfolio value (principal + accruedYieldUsdc, see
 * src/lib/data/portfolio.ts) visibly climbs on /portfolio without waiting for
 * a real distribution cycle.
 *
 * DRY-RUN BY DEFAULT. Without --execute this script only prints the computed
 * before/after plan — it never writes to the database. --execute performs the
 * actual update inside a transaction (+ an optional InvestorNavSnapshot row
 * so the hero chart refreshes too).
 *
 * NEVER writes an InvestorTransaction — real distributions go through a
 * separate admin flow; this tool only moves the "not yet distributed" accrual
 * bucket, exactly like scripts/seed-dev-position.ts's ACCRUED fixture.
 *
 * PROD GUARD: same production-ref detection as scripts/lib/prisma-cli.ts
 * (Supabase ref xrwzxhsenwmlxbwqcftz / connect.hearst.app), but applied ONLY
 * at the --execute write step — not at client construction — so a dry run
 * can still read a prod-pointed DATABASE_URL (e.g. a prod-pointed
 * .env.local) to preview the plan without requiring ALLOW_PROD_WRITES=1.
 * makePrismaClient() in prisma-cli.ts throws on ANY prod connection (reads
 * included), which doesn't fit a read-only dry run, so the guard is
 * reproduced here and gated on the actual write instead (see
 * assertProdWriteAllowed below).
 *
 * Usage:
 *   npx tsx scripts/demo/yield-tick.ts --email <email> --amount <usdc> \
 *     [--position-id <id>] [--snapshot] [--execute]
 *
 * Examples:
 *   # Dry run — show the plan, write nothing.
 *   npx tsx scripts/demo/yield-tick.ts --email zand.demo@hearstcorporation.io --amount 1500
 *
 *   # Apply for real (local/dev DB) and refresh the NAV chart.
 *   npx tsx scripts/demo/yield-tick.ts --email zand.demo@hearstcorporation.io --amount 1500 --snapshot --execute
 *
 *   # Apply for real against PRODUCTION (explicit opt-in required).
 *   ALLOW_PROD_WRITES=1 npx tsx scripts/demo/yield-tick.ts --email zand.demo@hearstcorporation.io --amount 1500 --execute
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { PrismaClient, Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

import { resolvePrismaProvider } from "../../src/lib/prisma-provider-resolve-core";

// ── ALLOW_PROD_WRITES: capture the REAL process env BEFORE the .env.local
// fallback loader runs ────────────────────────────────────────────────────
// The loader below fills in every key absent from process.env from
// .env.local/.env — including, if someone left it there, an
// ALLOW_PROD_WRITES=1 line. That must never silently arm the prod-write
// guard: ALLOW_PROD_WRITES is a per-invocation, command-line-only opt-in
// (see assertProdWriteAllowed below), not a file-configurable default.
// Capturing it here, before the loader touches process.env, means
// assertProdWriteAllowed only ever sees a value that came from the caller's
// actual shell/CI environment.
const allowProdWritesFromRealEnv = process.env.ALLOW_PROD_WRITES;

// ── .env.local fallback (no dotenv dep, mirrors scripts/pilot-e2e.ts) ─────
// `tsx` does not auto-load .env.local the way `next dev`/`next build` do, so
// a bare `npx tsx scripts/demo/yield-tick.ts ...` would otherwise silently
// fall back to the sqlite dev-db default and never see the real
// DATABASE_URL/PRISMA_PROVIDER. Precedence matches scripts/preflight-prod.mjs:
// real process.env (already exported by the caller's shell) always wins over
// .env.local, which wins over .env.
//
// ALLOW_PROD_WRITES is explicitly skipped here (double ceinture alongside the
// captured `allowProdWritesFromRealEnv` above): even if a stray
// ALLOW_PROD_WRITES=1 line exists in .env.local/.env, it must never reach
// process.env through this loader and silently arm a production write.
function loadDotEnvFallback(file: string): void {
  let raw: string;
  try {
    raw = readFileSync(resolve(process.cwd(), file), "utf8");
  } catch {
    return;
  }
  for (const line of raw.split("\n")) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line);
    if (!match) continue;
    const key = match[1];
    if (!key || key === "ALLOW_PROD_WRITES") continue;
    if (process.env[key] !== undefined) continue;
    process.env[key] = (match[2] ?? "").replace(/^"|"$/g, "");
  }
}
loadDotEnvFallback(".env.local");
loadDotEnvFallback(".env");

// ── Constants ────────────────────────────────────────────────────────────

const MAX_AMOUNT_USDC = 100_000;
const SNAPSHOT_SOURCE = "demo_tick";
/** Same production Supabase project ref guarded by scripts/lib/prisma-cli.ts. */
const PROD_DB_REF = "xrwzxhsenwmlxbwqcftz";

// ── CLI parsing ──────────────────────────────────────────────────────────

interface CliArgs {
  email: string;
  amount: number;
  positionId: string | null;
  snapshot: boolean;
  execute: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  let email: string | null = null;
  let amountRaw: string | null = null;
  let positionId: string | null = null;
  let snapshot = false;
  let execute = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === undefined) continue;

    switch (arg) {
      case "--email":
        i += 1;
        email = argv[i] ?? null;
        break;
      case "--amount":
        i += 1;
        amountRaw = argv[i] ?? null;
        break;
      case "--position-id":
        i += 1;
        positionId = argv[i] ?? null;
        break;
      case "--snapshot":
        snapshot = true;
        break;
      case "--execute":
        execute = true;
        break;
      default:
        throw new Error(`Unknown argument: "${arg}"`);
    }
  }

  if (!email) {
    throw new Error("Missing required --email <email>");
  }
  if (!amountRaw) {
    throw new Error("Missing required --amount <usdc>");
  }

  const amount = Number(amountRaw);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(`--amount must be a positive finite number, got "${amountRaw}"`);
  }
  if (amount > MAX_AMOUNT_USDC) {
    throw new Error(
      `--amount exceeds the safety cap of $${MAX_AMOUNT_USDC.toLocaleString()} (got $${amount.toLocaleString()})`,
    );
  }

  return { email: email.trim(), amount, positionId, snapshot, execute };
}

// ── Prisma client (mirrors scripts/lib/prisma-cli.ts's provider/adapter
//    selection, minus the automatic prod-connection throw — see header) ──

function readSchemaProvider(): "sqlite" | "postgresql" | null {
  try {
    const schema = readFileSync(resolve(process.cwd(), "prisma/schema.prisma"), "utf8");
    const match = /datasource\s+\w+\s*\{[^}]*?\n\s*provider\s*=\s*"(\w+)"/s.exec(schema);
    const provider = match?.[1];
    if (provider === "sqlite" || provider === "postgresql") return provider;
  } catch {
    // fall through to env inference
  }
  return null;
}

function getDatabaseUrl(): string {
  return process.env.DATABASE_URL?.trim() ?? "file:./prisma/dev.db";
}

function makeClient(): PrismaClient {
  const provider =
    process.env.PRISMA_PROVIDER?.trim() === "sqlite" ||
    process.env.PRISMA_PROVIDER?.trim() === "postgresql"
      ? (process.env.PRISMA_PROVIDER.trim() as "sqlite" | "postgresql")
      : (readSchemaProvider() ?? resolvePrismaProvider());
  const databaseUrl = getDatabaseUrl();

  if (provider === "postgresql") {
    return new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
  }

  const url = databaseUrl.startsWith("file:") ? databaseUrl.slice("file:".length) : databaseUrl;
  return new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });
}

/**
 * Fail-closed prod-write guard — identical detection to prisma-cli.ts's
 * assertNotProdUnlessAllowed, but called ONLY right before the --execute
 * transaction, not at client construction (see file header).
 *
 * Reads `allowProdWritesFromRealEnv` (captured at the top of this file,
 * BEFORE the .env.local/.env fallback loader ran) instead of
 * `process.env.ALLOW_PROD_WRITES` directly — so a stray ALLOW_PROD_WRITES=1
 * line sitting in .env.local/.env can never arm this guard. The flag is only
 * honored when it comes from the actual command line / shell / CI env.
 */
function assertProdWriteAllowed(databaseUrl: string): void {
  const targetsProd = databaseUrl.includes(PROD_DB_REF);
  if (!targetsProd) return;

  const allowed = allowProdWritesFromRealEnv?.trim() === "1";
  if (allowed) {
    console.warn(
      "⚠️  yield-tick: DATABASE_URL targets PRODUCTION — writing because ALLOW_PROD_WRITES=1.",
    );
    return;
  }

  throw new Error(
    [
      "REFUSING to write: DATABASE_URL points at the PRODUCTION database",
      `(Supabase ref ${PROD_DB_REF} / connect.hearst.app).`,
      "",
      "ALLOW_PROD_WRITES must be passed on the command line (a value in",
      ".env.local/.env is ignored on purpose) — re-run with:",
      "  ALLOW_PROD_WRITES=1 npx tsx scripts/demo/yield-tick.ts ... --execute",
    ].join("\n"),
  );
}

// ── Numeric helpers (mirror src/lib/data/portfolio.ts's toNumber) ────────

function toNumber(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return parseFloat(v);
  if (v !== null && typeof v === "object" && "toNumber" in v) {
    return (v as { toNumber(): number }).toNumber();
  }
  return 0;
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

function fmtUsd(v: number): string {
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** UTC hour bucket — mirrors truncateToUtcHour in src/lib/portfolio/investor-nav-snapshot.ts. */
function truncateToUtcHour(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), 0, 0, 0),
  );
}

// ── Main ───────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const databaseUrl = getDatabaseUrl();
  const prisma = makeClient();

  try {
    const user = await prisma.user.findUnique({
      where: { email: args.email },
      include: { investor: true },
    });
    if (!user) {
      throw new Error(`No user found for email "${args.email}"`);
    }
    const investorId = user.investor?.id;
    if (!investorId) {
      throw new Error(`User "${args.email}" has no investor profile`);
    }

    // All active/matured positions — needed to preview the investor-level NAV
    // total the same way computeInvestorNavUsdc() does (src/lib/portfolio/
    // investor-nav-snapshot.ts), in case the investor holds more than one.
    const allPositions = await prisma.position.findMany({
      where: { investorId, status: { in: ["active", "matured"] } },
      select: {
        id: true,
        principalUsdc: true,
        accruedYieldUsdc: true,
        status: true,
        vaultKey: true,
        subscribedAt: true,
        vaultDeployment: { select: { name: true } },
      },
      orderBy: { subscribedAt: "desc" },
    });

    if (allPositions.length === 0) {
      throw new Error(`Investor "${args.email}" has no active/matured position`);
    }

    const target = args.positionId
      ? allPositions.find((p) => p.id === args.positionId)
      : (allPositions.find((p) => p.status === "active") ?? allPositions[0]);

    if (!target) {
      throw new Error(
        args.positionId
          ? `Position "${args.positionId}" not found (or not active/matured) for "${args.email}"`
          : `No suitable position found for "${args.email}"`,
      );
    }

    const principal = toNumber(target.principalUsdc);
    const accruedBefore = toNumber(target.accruedYieldUsdc);
    const accruedAfter = round2(accruedBefore + args.amount);
    const valueBefore = round2(principal + accruedBefore);
    const valueAfter = round2(principal + accruedAfter);

    const navBefore = round2(
      allPositions.reduce(
        (sum, p) => sum + toNumber(p.principalUsdc) + toNumber(p.accruedYieldUsdc),
        0,
      ),
    );
    const navAfter = round2(navBefore - accruedBefore + accruedAfter);

    const takenAt = truncateToUtcHour(new Date());

    console.log("── Yield tick plan ─────────────────────────────────────────");
    console.log(`investor        ${args.email} (investor ${investorId})`);
    console.log(
      `position        ${target.id}  [${target.status}]  vault=${target.vaultDeployment?.name ?? target.vaultKey}`,
    );
    console.log(`principal       ${fmtUsd(principal)}`);
    console.log(`accrued before  ${fmtUsd(accruedBefore)}`);
    console.log(`accrued after   ${fmtUsd(accruedAfter)}   (+${fmtUsd(args.amount)})`);
    console.log(`value before    ${fmtUsd(valueBefore)}`);
    console.log(`value after     ${fmtUsd(valueAfter)}`);
    if (allPositions.length > 1) {
      console.log(`investor NAV before (all positions)  ${fmtUsd(navBefore)}`);
      console.log(`investor NAV after  (all positions)  ${fmtUsd(navAfter)}`);
    }
    if (args.snapshot) {
      console.log(
        `snapshot        InvestorNavSnapshot upsert @ ${takenAt.toISOString()} valueUsdc=${fmtUsd(navAfter)} source="${SNAPSHOT_SOURCE}"`,
      );
    }

    if (!args.execute) {
      console.log("");
      console.log("DRY RUN — no write performed. Re-run with --execute to apply.");
      return;
    }

    assertProdWriteAllowed(databaseUrl);

    const ops: Prisma.PrismaPromise<unknown>[] = [
      prisma.position.update({
        where: { id: target.id },
        data: { accruedYieldUsdc: accruedAfter },
      }),
    ];
    if (args.snapshot) {
      ops.push(
        prisma.investorNavSnapshot.upsert({
          where: { investorId_takenAt: { investorId, takenAt } },
          create: { investorId, takenAt, valueUsdc: navAfter, source: SNAPSHOT_SOURCE },
          update: { valueUsdc: navAfter, source: SNAPSHOT_SOURCE },
        }),
      );
    }

    await prisma.$transaction(ops);

    const after = await prisma.position.findUniqueOrThrow({
      where: { id: target.id },
      select: { id: true, accruedYieldUsdc: true, principalUsdc: true },
    });
    const confirmedAccrued = toNumber(after.accruedYieldUsdc);
    const confirmedValue = round2(toNumber(after.principalUsdc) + confirmedAccrued);

    console.log("");
    console.log("✓ Applied.");
    console.log(
      `  position ${after.id}: accruedYieldUsdc=${fmtUsd(confirmedAccrued)} value=${fmtUsd(confirmedValue)}`,
    );

    if (args.snapshot) {
      const snap = await prisma.investorNavSnapshot.findUniqueOrThrow({
        where: { investorId_takenAt: { investorId, takenAt } },
      });
      console.log(
        `  snapshot ${snap.id}: takenAt=${snap.takenAt.toISOString()} valueUsdc=${fmtUsd(toNumber(snap.valueUsdc))}`,
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
