/**
 * Demo lever: "time machine" — age a demo investor's position through the
 * lifecycle stages a client demo wants to show without waiting for real
 * calendar time to pass: fresh subscription → 12 months in → 24 months in →
 * expired/matured. Also knows how to reset an investor back to zero (so the
 * in-product "Simulate deposit" button can re-create the position from
 * scratch) and, as a fallback, how to create the opening subscription itself
 * when driving it through the UI isn't an option.
 *
 * DRY-RUN BY DEFAULT. Without --execute this script only prints the computed
 * before/after plan for the selected stage — it never writes to the database.
 * --execute performs the actual writes inside a single $transaction.
 *
 * Every age stage (12m / 24m / expiry) is IDEMPOTENT: it POSES the complete
 * target state for the position by first deleting the rows *this script*
 * generated for that position (its `distribution` transactions, and its
 * InvestorNavSnapshot rows tagged source="demo_timeline") before recreating
 * them from scratch. It never touches the original opening `deposit`
 * transaction, and never touches another investor's data — every write is
 * scoped to the resolved investorId / positionId.
 *
 * PROD GUARD: same production-ref detection + call-site gating as
 * scripts/demo/yield-tick.ts (which mirrors scripts/lib/prisma-cli.ts) — a dry
 * run can read a prod-pointed DATABASE_URL freely; the guard only fires right
 * before the --execute write.
 *
 * Usage:
 *   npx tsx scripts/demo/timeline.ts --stage <reset|subscribe|12m|24m|expiry> \
 *     [--email <email>] [--position-id <id>] [--amount <usdc>] [--execute]
 *
 * Examples:
 *   # Dry run — show what reset would wipe, write nothing.
 *   npx tsx scripts/demo/timeline.ts --stage reset
 *
 *   # Fallback subscribe (no UI available) — dry run, then apply.
 *   npx tsx scripts/demo/timeline.ts --stage subscribe --amount 250000
 *   npx tsx scripts/demo/timeline.ts --stage subscribe --amount 250000 --execute
 *
 *   # Age the position to "24 months in", still active.
 *   npx tsx scripts/demo/timeline.ts --stage 24m --execute
 *
 *   # Age to expiry (matured, default 24-month term).
 *   npx tsx scripts/demo/timeline.ts --stage expiry --execute
 *
 *   # Apply for real against PRODUCTION (explicit opt-in required).
 *   ALLOW_PROD_WRITES=1 npx tsx scripts/demo/timeline.ts --stage 12m --execute
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { PrismaClient, Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

import { resolvePrismaProvider } from "../../src/lib/prisma-provider-resolve-core";

// ── ALLOW_PROD_WRITES: capture the REAL process env BEFORE the .env.local
// fallback loader runs (see scripts/demo/yield-tick.ts for the full rationale
// this mirrors) ────────────────────────────────────────────────────────────
const allowProdWritesFromRealEnv = process.env.ALLOW_PROD_WRITES;

// ── .env.local fallback (no dotenv dep, mirrors scripts/demo/yield-tick.ts) ─
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

const DEFAULT_EMAIL = "zand.demo@hearstcorporation.io";
/** Same VaultDeployment id used by scripts/seed-dev-position.ts and the real subscribe flow. */
const VAULT_ID = "hearst-yield-vault";
/** subscribe-logic.ts's createPositionInTransaction convention: `${vaultId}:class-${code}`. */
const VAULT_KEY = `${VAULT_ID}:class-A`;

const MIN_SUBSCRIBE_USDC = 250_000; // SHARE_CLASS_A.minTicketUsdc
const MAX_PRINCIPAL_USDC = 5_000_000; // safety cap — subscribe amount AND any position aged by this script
const MAX_MONTHS = 36; // safety cap on how far back a stage may backdate subscribedAt

/** Fallback APY range (pct*100 bps) when the position has no linked VaultDeployment row. */
const FALLBACK_APY_LOW_BPS = 940; // 9.4%
const FALLBACK_APY_HIGH_BPS = 1280; // 12.8%

const EXPIRY_TERM_MONTHS = 24; // default term length for the "expiry" stage

const SNAPSHOT_SOURCE = "demo_timeline";
/** Same production Supabase project ref guarded by scripts/lib/prisma-cli.ts. */
const PROD_DB_REF = "xrwzxhsenwmlxbwqcftz";

type Stage = "reset" | "subscribe" | "12m" | "24m" | "expiry";
const STAGES: readonly Stage[] = ["reset", "subscribe", "12m", "24m", "expiry"];

// ── CLI parsing ──────────────────────────────────────────────────────────

interface CliArgs {
  email: string;
  positionId: string | null;
  stage: Stage;
  amount: number | null;
  execute: boolean;
}

function isStage(v: string): v is Stage {
  return (STAGES as readonly string[]).includes(v);
}

function parseArgs(argv: string[]): CliArgs {
  let email: string | null = null;
  let positionId: string | null = null;
  let stageRaw: string | null = null;
  let amountRaw: string | null = null;
  let execute = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === undefined) continue;

    switch (arg) {
      case "--email":
        i += 1;
        email = argv[i] ?? null;
        break;
      case "--position-id":
        i += 1;
        positionId = argv[i] ?? null;
        break;
      case "--stage":
        i += 1;
        stageRaw = argv[i] ?? null;
        break;
      case "--amount":
        i += 1;
        amountRaw = argv[i] ?? null;
        break;
      case "--execute":
        execute = true;
        break;
      default:
        throw new Error(`Unknown argument: "${arg}"`);
    }
  }

  if (!stageRaw) {
    throw new Error(
      `Missing required --stage <${STAGES.join("|")}>`,
    );
  }
  if (!isStage(stageRaw)) {
    throw new Error(`--stage must be one of ${STAGES.join("|")}, got "${stageRaw}"`);
  }

  let amount: number | null = null;
  if (amountRaw !== null) {
    amount = Number(amountRaw);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error(`--amount must be a positive finite number, got "${amountRaw}"`);
    }
  }

  if (stageRaw === "subscribe") {
    if (amount === null) {
      throw new Error('Missing required --amount <usdc> for --stage subscribe');
    }
    if (amount < MIN_SUBSCRIBE_USDC) {
      throw new Error(
        `--amount must be at least $${MIN_SUBSCRIBE_USDC.toLocaleString()} (Class A minimum ticket), got $${amount.toLocaleString()}`,
      );
    }
    if (amount > MAX_PRINCIPAL_USDC) {
      throw new Error(
        `--amount exceeds the safety cap of $${MAX_PRINCIPAL_USDC.toLocaleString()} (got $${amount.toLocaleString()})`,
      );
    }
  } else if (amount !== null) {
    console.warn(`--amount is ignored for --stage ${stageRaw} (only --stage subscribe uses it).`);
  }

  return {
    email: (email ?? DEFAULT_EMAIL).trim(),
    positionId,
    stage: stageRaw,
    amount,
    execute,
  };
}

// ── Prisma client (mirrors scripts/demo/yield-tick.ts's provider/adapter
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
 * assertNotProdUnlessAllowed, called ONLY right before an --execute write.
 * Reads `allowProdWritesFromRealEnv` (captured before the .env.local loader
 * ran), never the post-loader process.env, so a stray ALLOW_PROD_WRITES=1
 * line in .env.local/.env can never arm this guard on its own.
 */
function assertProdWriteAllowed(databaseUrl: string): void {
  const targetsProd = databaseUrl.includes(PROD_DB_REF);
  if (!targetsProd) return;

  const allowed = allowProdWritesFromRealEnv?.trim() === "1";
  if (allowed) {
    console.warn(
      "⚠️  timeline: DATABASE_URL targets PRODUCTION — writing because ALLOW_PROD_WRITES=1.",
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
      "  ALLOW_PROD_WRITES=1 npx tsx scripts/demo/timeline.ts ... --execute",
    ].join("\n"),
  );
}

// ── Numeric / date helpers (mirror src/lib/data/portfolio.ts's toNumber and
//    src/lib/portfolio/investor-nav-snapshot.ts's truncateToUtcHour) ──────

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

function fmtDate(d: Date | null): string {
  return d ? d.toISOString() : "—";
}

/** UTC hour bucket — mirrors truncateToUtcHour in src/lib/portfolio/investor-nav-snapshot.ts. */
function truncateToUtcHour(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), 0, 0, 0),
  );
}

/** UTC first-of-month, midnight. */
function firstOfMonthUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0));
}

/** Number of days in the UTC month containing `year`/`month0` (0-based month). */
function daysInUtcMonth(year: number, month0: number): number {
  return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
}

/**
 * Shift `date` by `deltaMonths` calendar months (negative = backward), UTC,
 * clamping the day-of-month so e.g. Jan 31 - 1 month lands on Feb 28/29
 * instead of silently rolling into March. Deterministic, no PRNG.
 */
function addMonthsUtc(date: Date, deltaMonths: number): Date {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  const d = date.getUTCDate();
  const h = date.getUTCHours();
  const mi = date.getUTCMinutes();
  const s = date.getUTCSeconds();

  const anchor = new Date(Date.UTC(y, m + deltaMonths, 1, h, mi, s));
  const ty = anchor.getUTCFullYear();
  const tm = anchor.getUTCMonth();
  const clampedDay = Math.min(d, daysInUtcMonth(ty, tm));
  return new Date(Date.UTC(ty, tm, clampedDay, h, mi, s));
}

// ── Shared investor / position resolution ─────────────────────────────────

interface ResolvedInvestor {
  investorId: string;
  email: string;
}

async function resolveInvestor(
  prisma: PrismaClient,
  email: string,
): Promise<ResolvedInvestor> {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { investor: true },
  });
  if (!user) {
    throw new Error(`No user found for email "${email}"`);
  }
  const investorId = user.investor?.id;
  if (!investorId) {
    throw new Error(`User "${email}" has no investor profile`);
  }
  return { investorId, email };
}

type TargetPosition = Prisma.PositionGetPayload<{ include: { vaultDeployment: true } }>;

/**
 * Resolve the position an age stage should act on: the explicit --position-id
 * (must belong to this investor) or, by default, the investor's most
 * recently subscribed active/matured position. Returns null only when no
 * --position-id was given AND the investor has no active/matured position at
 * all — callers use that to offer a hypothetical/simulated preview instead of
 * crashing.
 */
async function resolveTargetPosition(
  prisma: PrismaClient,
  investorId: string,
  positionId: string | null,
): Promise<TargetPosition | null> {
  if (positionId) {
    const position = await prisma.position.findFirst({
      where: { id: positionId, investorId },
      include: { vaultDeployment: true },
    });
    if (!position) {
      throw new Error(
        `Position "${positionId}" not found (or does not belong to this investor)`,
      );
    }
    return position;
  }

  return prisma.position.findFirst({
    where: { investorId, status: { in: ["active", "matured"] } },
    include: { vaultDeployment: true },
    orderBy: { subscribedAt: "desc" },
  });
}

/** Resolve the mid-APY (pct) + low/high bps for a position, falling back when unlinked. */
function resolveApyBps(position: { vaultDeployment: { targetApyLowBps: number; targetApyHighBps: number } | null }): {
  lowBps: number;
  highBps: number;
  midApyPct: number;
} {
  const lowBps = position.vaultDeployment?.targetApyLowBps ?? FALLBACK_APY_LOW_BPS;
  const highBps = position.vaultDeployment?.targetApyHighBps ?? FALLBACK_APY_HIGH_BPS;
  const midApyPct = (lowBps + highBps) / 2 / 100;
  return { lowBps, highBps, midApyPct };
}

function assertPrincipalWithinCap(principal: number): void {
  if (principal > MAX_PRINCIPAL_USDC) {
    throw new Error(
      `Refusing: position principal ${fmtUsd(principal)} exceeds the safety cap of ${fmtUsd(MAX_PRINCIPAL_USDC)}.`,
    );
  }
}

// ── Stage: reset ───────────────────────────────────────────────────────────

async function runReset(
  prisma: PrismaClient,
  databaseUrl: string,
  investorId: string,
  email: string,
  execute: boolean,
): Promise<void> {
  const [positions, txCount, navCount] = await Promise.all([
    prisma.position.findMany({
      where: { investorId },
      select: { id: true, principalUsdc: true, status: true, subscribedAt: true },
      orderBy: { subscribedAt: "desc" },
    }),
    prisma.investorTransaction.count({ where: { investorId } }),
    prisma.investorNavSnapshot.count({ where: { investorId } }),
  ]);

  console.log("── Reset plan ──────────────────────────────────────────────");
  console.log(`investor          ${email} (investor ${investorId})`);

  if (positions.length === 0 && txCount === 0 && navCount === 0) {
    console.log("0 position, rien à supprimer.");
    return;
  }

  console.log(`positions to delete       ${positions.length}`);
  for (const p of positions) {
    console.log(
      `  - ${p.id}  [${p.status}]  principal=${fmtUsd(toNumber(p.principalUsdc))}  subscribedAt=${p.subscribedAt.toISOString()}`,
    );
  }
  console.log(`transactions to delete     ${txCount}`);
  console.log(`nav snapshots to delete    ${navCount}`);

  if (!execute) {
    console.log("");
    console.log("DRY RUN — no write performed. Re-run with --execute to apply.");
    return;
  }

  assertProdWriteAllowed(databaseUrl);

  // Delete child InvestorTransaction rows before their parent Position rows
  // (FK on InvestorTransaction.positionId), then the investor's NAV history.
  const ops: Prisma.PrismaPromise<unknown>[] = [
    prisma.investorTransaction.deleteMany({ where: { investorId } }),
    prisma.position.deleteMany({ where: { investorId } }),
    prisma.investorNavSnapshot.deleteMany({ where: { investorId } }),
  ];
  await prisma.$transaction(ops);

  console.log("");
  console.log(
    `✓ Reset applied. Deleted ${positions.length} position(s), ${txCount} transaction(s), ${navCount} nav snapshot(s).`,
  );
}

// ── Stage: subscribe (fallback opening deposit) ────────────────────────────

async function runSubscribe(
  prisma: PrismaClient,
  databaseUrl: string,
  investorId: string,
  email: string,
  amount: number,
  execute: boolean,
): Promise<void> {
  const existing = await prisma.position.findMany({
    where: { investorId, status: { in: ["active", "matured"] } },
    select: { id: true, status: true },
  });
  if (existing.length > 0) {
    throw new Error(
      `Investor already has ${existing.length} active/matured position(s) (${existing
        .map((p) => `${p.id}[${p.status}]`)
        .join(", ")}) — run --stage reset first before --stage subscribe.`,
    );
  }

  const vault = await prisma.vaultDeployment.findUnique({
    where: { id: VAULT_ID },
    select: { id: true, name: true },
  });
  const vaultDeploymentId = vault?.id ?? null;
  const now = new Date();

  console.log("── Subscribe plan ──────────────────────────────────────────");
  console.log(`investor          ${email} (investor ${investorId})`);
  console.log(`vault             ${vault?.name ?? `"${VAULT_ID}" (no VaultDeployment row found — vaultDeploymentId will be null)`}`);
  console.log(`vaultKey          ${VAULT_KEY}`);
  console.log(`principal         ${fmtUsd(amount)}`);
  console.log(`subscribedAt      ${now.toISOString()}`);
  console.log(`opening deposit   InvestorTransaction type=deposit amount=${fmtUsd(amount)} occurredAt=${now.toISOString()}`);

  if (!execute) {
    console.log("");
    console.log("DRY RUN — no write performed. Re-run with --execute to apply.");
    return;
  }

  assertProdWriteAllowed(databaseUrl);

  const ops: Prisma.PrismaPromise<unknown>[] = [
    prisma.position.create({
      data: {
        investorId,
        vaultDeploymentId,
        vaultKey: VAULT_KEY,
        principalUsdc: amount,
        accruedYieldUsdc: 0,
        distributedUsdc: 0,
        status: "active",
        subscribedAt: now,
        transactions: {
          create: {
            investorId,
            type: "deposit",
            amountUsdc: amount,
            occurredAt: now,
          },
        },
      },
    }),
  ];
  await prisma.$transaction(ops);

  const created = await prisma.position.findFirstOrThrow({
    where: { investorId, status: "active" },
    orderBy: { subscribedAt: "desc" },
  });

  console.log("");
  console.log(`✓ Applied. Created position ${created.id} — principal=${fmtUsd(toNumber(created.principalUsdc))}.`);
}

// ── Stage: 12m / 24m / expiry (age the position) ───────────────────────────

interface AgeStageOptions {
  months: number;
  finalStatus: "active" | "matured";
}

/**
 * Build a hypothetical preview (no real position exists yet) so a dry run
 * never crashes — it shows what the stage WOULD look like on a freshly
 * subscribed $250k Class A position, clearly labelled as simulated. In
 * --execute mode there is nothing real to write, so this refuses instead.
 */
function previewHypothetical(email: string, stage: Stage, opts: AgeStageOptions, execute: boolean): void {
  const now = new Date();
  const principal = MIN_SUBSCRIBE_USDC;
  const { lowBps, highBps, midApyPct } = resolveApyBps({ vaultDeployment: null });
  const monthlyPayment = round2((principal * (midApyPct / 100)) / 12);
  const distributedTotal = round2(monthlyPayment * opts.months);
  const dayOfMonth = now.getUTCDate();
  const daysInCurrentMonth = daysInUtcMonth(now.getUTCFullYear(), now.getUTCMonth());
  const elapsedFraction = Math.min(dayOfMonth / daysInCurrentMonth, 0.5);
  const accruedAfter = round2(monthlyPayment * elapsedFraction);
  const newSubscribedAt = addMonthsUtc(now, -opts.months);

  console.log(`── ${stage} plan (SIMULATED — no real position exists) ──────`);
  console.log(`investor          ${email}`);
  console.log("No active/matured position found for this investor, and no --position-id was given.");
  console.log(
    `Showing a HYPOTHETICAL preview on a fresh $${principal.toLocaleString()} Class A subscription —`,
  );
  console.log('nothing is aged yet. Run --stage subscribe first (or the UI "Simulate deposit"');
  console.log("button), then re-run this stage against the real position.");
  console.log("");
  console.log(`assumed principal        ${fmtUsd(principal)}  (Class A minimum ticket)`);
  console.log(`assumed vault APY         ${(lowBps / 100).toFixed(1)}-${(highBps / 100).toFixed(1)}%  (fallback — no linked VaultDeployment)`);
  console.log(`assumed subscribedAt      ${newSubscribedAt.toISOString()}  (now − ${opts.months}mo)`);
  console.log(`monthly payment           ${fmtUsd(monthlyPayment)} × ${opts.months} months`);
  console.log(`distributedUsdc (sim)     ${fmtUsd(distributedTotal)}`);
  console.log(`accruedYieldUsdc (sim)    ${fmtUsd(accruedAfter)}  (current-month fraction ${(elapsedFraction * 100).toFixed(1)}%, capped 50%)`);
  console.log(`final status (sim)        ${opts.finalStatus}`);

  if (execute) {
    throw new Error(
      `Refusing --execute: no real active/matured position exists for "${email}" — run --stage subscribe first.`,
    );
  }

  console.log("");
  console.log("DRY RUN (simulated) — no write performed, no real position to act on.");
}

async function runAgeStage(
  prisma: PrismaClient,
  databaseUrl: string,
  investorId: string,
  email: string,
  positionId: string | null,
  stage: Stage,
  opts: AgeStageOptions,
  execute: boolean,
): Promise<void> {
  if (opts.months > MAX_MONTHS) {
    throw new Error(`Refusing: ${opts.months} months exceeds the safety cap of ${MAX_MONTHS} months.`);
  }

  const target = await resolveTargetPosition(prisma, investorId, positionId);
  if (!target) {
    previewHypothetical(email, stage, opts, execute);
    return;
  }

  const principal = toNumber(target.principalUsdc);
  assertPrincipalWithinCap(principal);

  const now = new Date();
  const { lowBps, highBps, midApyPct } = resolveApyBps(target);
  const monthlyPayment = round2((principal * (midApyPct / 100)) / 12);
  const distributedTotal = round2(monthlyPayment * opts.months);

  const dayOfMonth = now.getUTCDate();
  const daysInCurrentMonth = daysInUtcMonth(now.getUTCFullYear(), now.getUTCMonth());
  // Bounded at 50% so the "in progress" accrual reads as a small pending
  // amount, never as almost-a-full-month already earned but undistributed.
  const elapsedFraction = Math.min(dayOfMonth / daysInCurrentMonth, 0.5);
  const accruedAfter = round2(monthlyPayment * elapsedFraction);

  const newSubscribedAt = addMonthsUtc(now, -opts.months);
  const maturedAt = opts.finalStatus === "matured" ? now : null;

  // Distribution months: the last `months` completed 1st-of-month dates,
  // i.e. { 0, 1, ..., months-1 } months before the current month's 1st —
  // most recent distribution = the start of the current month; the partial
  // current-month accrual above is what's accrued SINCE that distribution.
  const nowFirstOfMonth = firstOfMonthUtc(now);
  const distributionMonths: Date[] = [];
  for (let monthsAgo = opts.months - 1; monthsAgo >= 0; monthsAgo -= 1) {
    distributionMonths.push(addMonthsUtc(nowFirstOfMonth, -monthsAgo));
  }

  // Investor-level NAV baseline from every OTHER active/matured position —
  // held flat across the backdated history (a documented simplification;
  // those positions aren't being aged by this run).
  const otherPositions = await prisma.position.findMany({
    where: { investorId, status: { in: ["active", "matured"] }, NOT: { id: target.id } },
    select: { principalUsdc: true, accruedYieldUsdc: true },
  });
  const otherValueUsdc = round2(
    otherPositions.reduce((sum, p) => sum + toNumber(p.principalUsdc) + toNumber(p.accruedYieldUsdc), 0),
  );

  // Monthly NAV snapshots — value is flat at principal right after each
  // month's distribution resets accrual to 0 (this is intentional, not a
  // bug: yield is DISTRIBUTED not capitalized, so position value stays ≈
  // principal; the growth shows up in the cumulative distributions, not
  // here). "expiry" additionally appends one snapshot at `now` carrying the
  // partial current-month accrual, for a final chart point at maturity.
  const navSnapshotPlans: { takenAt: Date; valueUsdc: number }[] = distributionMonths.map((m) => ({
    takenAt: m,
    valueUsdc: round2(otherValueUsdc + principal),
  }));
  if (opts.finalStatus === "matured") {
    navSnapshotPlans.push({
      takenAt: truncateToUtcHour(now),
      valueUsdc: round2(otherValueUsdc + principal + accruedAfter),
    });
  }

  console.log(`── ${stage} plan ────────────────────────────────────────────`);
  console.log(`investor                  ${email} (investor ${investorId})`);
  console.log(`position                  ${target.id}  [${target.status} → ${opts.finalStatus}]`);
  console.log(`vault                     ${target.vaultDeployment?.name ?? target.vaultKey}  (apy ${(lowBps / 100).toFixed(1)}-${(highBps / 100).toFixed(1)}%, mid ${midApyPct.toFixed(2)}%)`);
  console.log(`principal (unchanged)     ${fmtUsd(principal)}`);
  console.log(`subscribedAt              ${target.subscribedAt.toISOString()} → ${newSubscribedAt.toISOString()}`);
  console.log(`maturedAt                 ${fmtDate(target.maturedAt)} → ${fmtDate(maturedAt)}`);
  console.log(`monthly payment           ${fmtUsd(monthlyPayment)} × ${opts.months} months`);
  console.log(`distributedUsdc           ${fmtUsd(toNumber(target.distributedUsdc))} → ${fmtUsd(distributedTotal)}`);
  console.log(
    `accruedYieldUsdc          ${fmtUsd(toNumber(target.accruedYieldUsdc))} → ${fmtUsd(accruedAfter)}  (current-month fraction ${(elapsedFraction * 100).toFixed(1)}%, capped 50%)`,
  );
  console.log(
    `distributions             delete existing distribution rows for this position, then create ${opts.months} row(s) from ${distributionMonths[0]!.toISOString()} to ${distributionMonths[distributionMonths.length - 1]!.toISOString()}`,
  );
  console.log(
    `nav snapshots             delete this script's prior snapshots (source="${SNAPSHOT_SOURCE}") for this investor, then upsert ${navSnapshotPlans.length} row(s)`,
  );

  if (!execute) {
    console.log("");
    console.log("DRY RUN — no write performed. Re-run with --execute to apply.");
    return;
  }

  assertProdWriteAllowed(databaseUrl);

  const ops: Prisma.PrismaPromise<unknown>[] = [
    // Scoped to THIS position's distribution rows only — never the opening
    // deposit (type="deposit"), never another position's rows.
    prisma.investorTransaction.deleteMany({ where: { positionId: target.id, type: "distribution" } }),
    // Scoped to rows THIS script created for THIS investor — never a
    // hourly-cron "computed" snapshot or a "dev_seed" fixture row.
    prisma.investorNavSnapshot.deleteMany({ where: { investorId, source: SNAPSHOT_SOURCE } }),
    prisma.position.update({
      where: { id: target.id },
      data: {
        subscribedAt: newSubscribedAt,
        accruedYieldUsdc: accruedAfter,
        distributedUsdc: distributedTotal,
        status: opts.finalStatus,
        maturedAt,
        exitedAt: null,
      },
    }),
    // Bulk insert the distribution rows in one statement — the deleteMany above
    // already removed this position's prior distribution rows, so there is no
    // unique conflict and createMany is both faster and well under the tx budget.
    prisma.investorTransaction.createMany({
      data: distributionMonths.map((occurredAt) => ({
        investorId,
        positionId: target.id,
        type: "distribution",
        amountUsdc: monthlyPayment,
        occurredAt,
      })),
    }),
    // NAV snapshots stay as upserts: a cron "computed" row may already occupy an
    // (investorId, takenAt) hour bucket, and createMany would violate the unique
    // constraint there — upsert overwrites it with this script's demo value.
    ...navSnapshotPlans.map((snap) =>
      prisma.investorNavSnapshot.upsert({
        where: { investorId_takenAt: { investorId, takenAt: snap.takenAt } },
        create: { investorId, takenAt: snap.takenAt, valueUsdc: snap.valueUsdc, source: SNAPSHOT_SOURCE },
        update: { valueUsdc: snap.valueUsdc, source: SNAPSHOT_SOURCE },
      }),
    ),
  ];
  // Default interactive-tx budget is 5s; over the Supabase pooler a 24-month
  // stage (deletes + createMany + ~24 upserts) can exceed it. Give ample headroom.
  await prisma.$transaction(ops, { timeout: 30_000, maxWait: 15_000 });

  console.log("");
  console.log(
    `✓ Applied. Position ${target.id} now [${opts.finalStatus}], distributedUsdc=${fmtUsd(distributedTotal)}, accruedYieldUsdc=${fmtUsd(accruedAfter)}.`,
  );
}

// ── Main ───────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const databaseUrl = getDatabaseUrl();
  const prisma = makeClient();

  try {
    const { investorId, email } = await resolveInvestor(prisma, args.email);

    switch (args.stage) {
      case "reset":
        await runReset(prisma, databaseUrl, investorId, email, args.execute);
        break;
      case "subscribe":
        // amount is guaranteed non-null for stage "subscribe" by parseArgs.
        await runSubscribe(prisma, databaseUrl, investorId, email, args.amount!, args.execute);
        break;
      case "12m":
        await runAgeStage(
          prisma,
          databaseUrl,
          investorId,
          email,
          args.positionId,
          args.stage,
          { months: 12, finalStatus: "active" },
          args.execute,
        );
        break;
      case "24m":
        await runAgeStage(
          prisma,
          databaseUrl,
          investorId,
          email,
          args.positionId,
          args.stage,
          { months: 24, finalStatus: "active" },
          args.execute,
        );
        break;
      case "expiry":
        await runAgeStage(
          prisma,
          databaseUrl,
          investorId,
          email,
          args.positionId,
          args.stage,
          { months: EXPIRY_TERM_MONTHS, finalStatus: "matured" },
          args.execute,
        );
        break;
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
