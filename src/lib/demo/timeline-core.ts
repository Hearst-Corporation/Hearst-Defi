import "server-only";

import type { Prisma, PrismaClient } from "@prisma/client";

/**
 * Pure-DB "time machine" core for aging a demo investor's position through
 * lifecycle stages — extracted from `scripts/demo/timeline.ts` so the exact
 * same math and writes are reachable from a Server Action (in-app demo
 * control), not only from the CLI script.
 *
 * Every function here takes an explicit `PrismaClient` + `investorId` and
 * performs its writes inside a single `$transaction` (30s timeout — a 24-month
 * stage does a couple of deletes + a createMany + ~24 upserts, which can
 * exceed the default 5s interactive-tx budget over the Supabase pooler).
 *
 * Callers are responsible for the demo-account gate (`isDemoAccount`) —
 * nothing in this module checks who is asking. It only ever touches the rows
 * scoped to the given `investorId` (and, within an age stage, the single
 * resolved `Position` row) — never another investor's data, never a global
 * wipe.
 *
 * No CLI concerns live here: no prod-write guard, no dry-run/execute split,
 * no console.log narration, no arg parsing. `scripts/demo/timeline.ts` keeps
 * ownership of all of that and MAY import this module for its actual writes
 * (optional refactor — not required for these functions to work standalone).
 */

// ── Constants (mirrors scripts/demo/timeline.ts) ────────────────────────────

/** Fallback APY range (pct*100 bps) when the position has no linked VaultDeployment row. */
const FALLBACK_APY_LOW_BPS = 940; // 9.4%
const FALLBACK_APY_HIGH_BPS = 1280; // 12.8%

/** Safety cap — subscribe amount AND any position aged by this module. */
const MAX_PRINCIPAL_USDC = 5_000_000;

/** Safety cap on how far back a stage may backdate subscribedAt. */
const MAX_MONTHS = 36;

const SNAPSHOT_SOURCE = "demo_timeline";

/** Interactive-tx budget for the age-stage writes (deletes + createMany + upserts). */
const TX_TIMEOUT_MS = 30_000;
const TX_MAX_WAIT_MS = 15_000;

export type FinalStatus = "active" | "matured";

export interface AdvanceOptions {
  months: number;
  matured: boolean;
}

export interface AdvanceResult {
  ok: true;
  positionId: string;
  distributedUsdc: number;
  accruedYieldUsdc: number;
  status: FinalStatus;
}

export interface ResetResult {
  ok: true;
  positionsDeleted: number;
  transactionsDeleted: number;
  navSnapshotsDeleted: number;
}

// ── Numeric / date helpers (mirror scripts/demo/timeline.ts) ────────────────

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

/** Resolve the mid-APY (pct) + low/high bps for a position, falling back when unlinked. */
function resolveApyBps(position: {
  vaultDeployment: { targetApyLowBps: number; targetApyHighBps: number } | null;
}): {
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
      `Refusing: position principal $${principal.toLocaleString()} exceeds the safety cap of $${MAX_PRINCIPAL_USDC.toLocaleString()}.`,
    );
  }
}

/**
 * Resolve the position an age stage should act on: the investor's most
 * recently subscribed active/matured position. Returns null when the
 * investor has no active/matured position at all.
 */
async function resolveTargetPosition(prisma: PrismaClient, investorId: string) {
  return prisma.position.findFirst({
    where: { investorId, status: { in: ["active", "matured"] } },
    include: { vaultDeployment: true },
    orderBy: { subscribedAt: "desc" },
  });
}

// ── resetInvestorTimeline ────────────────────────────────────────────────

/**
 * Wipes the given investor's positions, transactions, and NAV history —
 * scoped strictly to `investorId`. Mirrors `runReset`'s --execute path in
 * scripts/demo/timeline.ts (minus the dry-run plan printout and the prod-write
 * guard, both CLI-only concerns).
 */
export async function resetInvestorTimeline(
  prisma: PrismaClient,
  investorId: string,
): Promise<ResetResult> {
  const [positionsCount, transactionsCount, navSnapshotsCount] = await Promise.all([
    prisma.position.count({ where: { investorId } }),
    prisma.investorTransaction.count({ where: { investorId } }),
    prisma.investorNavSnapshot.count({ where: { investorId } }),
  ]);

  const ops: Prisma.PrismaPromise<unknown>[] = [
    // Children before parent (FK on InvestorTransaction.positionId).
    prisma.investorTransaction.deleteMany({ where: { investorId } }),
    prisma.position.deleteMany({ where: { investorId } }),
    prisma.investorNavSnapshot.deleteMany({ where: { investorId } }),
  ];
  await prisma.$transaction(ops);

  return {
    ok: true,
    positionsDeleted: positionsCount,
    transactionsDeleted: transactionsCount,
    navSnapshotsDeleted: navSnapshotsCount,
  };
}

// ── advanceInvestorTimeline ──────────────────────────────────────────────

/**
 * Ages the investor's most recent active/matured position forward by
 * `months`, optionally marking it `matured` at the end — same math as
 * `runAgeStage`'s --execute path in scripts/demo/timeline.ts:
 *   - backdates `subscribedAt` to now − months (day-of-month clamped)
 *   - deletes then recreates this position's `distribution` transactions
 *     (idempotent — never touches the opening `deposit` row)
 *   - deletes then upserts this script's own NAV snapshots
 *     (source="demo_timeline" — never a cron "computed" or "dev_seed" row)
 *   - sets `distributedUsdc` / `accruedYieldUsdc` from the mid-APY monthly rate
 *   - sets `status`/`maturedAt` when `matured` is requested
 *
 * Throws when the investor has no active/matured position to age (the
 * in-app control only makes sense once a position exists — unlike the CLI
 * script, this function does not synthesize a hypothetical preview).
 */
export async function advanceInvestorTimeline(
  prisma: PrismaClient,
  investorId: string,
  months: number,
  { matured }: { matured: boolean },
): Promise<AdvanceResult> {
  if (months > MAX_MONTHS) {
    throw new Error(`Refusing: ${months} months exceeds the safety cap of ${MAX_MONTHS} months.`);
  }

  const target = await resolveTargetPosition(prisma, investorId);
  if (!target) {
    throw new Error("No active/matured position found for this investor.");
  }

  const principal = toNumber(target.principalUsdc);
  assertPrincipalWithinCap(principal);

  const now = new Date();
  const { midApyPct } = resolveApyBps(target);
  const monthlyPayment = round2((principal * (midApyPct / 100)) / 12);
  const distributedTotal = round2(monthlyPayment * months);

  const dayOfMonth = now.getUTCDate();
  const daysInCurrentMonth = daysInUtcMonth(now.getUTCFullYear(), now.getUTCMonth());
  // Bounded at 50% so the "in progress" accrual reads as a small pending
  // amount, never as almost-a-full-month already earned but undistributed.
  const elapsedFraction = Math.min(dayOfMonth / daysInCurrentMonth, 0.5);
  const accruedAfter = round2(monthlyPayment * elapsedFraction);

  const newSubscribedAt = addMonthsUtc(now, -months);
  const finalStatus: FinalStatus = matured ? "matured" : "active";
  const maturedAt = matured ? now : null;

  // Distribution months: the last `months` completed 1st-of-month dates —
  // most recent distribution = the start of the current month; the partial
  // current-month accrual above is what's accrued SINCE that distribution.
  const nowFirstOfMonth = firstOfMonthUtc(now);
  const distributionMonths: Date[] = [];
  for (let monthsAgo = months - 1; monthsAgo >= 0; monthsAgo -= 1) {
    distributionMonths.push(addMonthsUtc(nowFirstOfMonth, -monthsAgo));
  }

  // Investor-level NAV baseline from every OTHER active/matured position —
  // held flat across the backdated history (a documented simplification;
  // those positions aren't being aged by this call).
  const otherPositions = await prisma.position.findMany({
    where: { investorId, status: { in: ["active", "matured"] }, NOT: { id: target.id } },
    select: { principalUsdc: true, accruedYieldUsdc: true },
  });
  const otherValueUsdc = round2(
    otherPositions.reduce((sum, p) => sum + toNumber(p.principalUsdc) + toNumber(p.accruedYieldUsdc), 0),
  );

  // Monthly NAV snapshots — value is flat at principal right after each
  // month's distribution resets accrual to 0 (yield is DISTRIBUTED not
  // capitalized). When `matured`, append one final snapshot at `now` carrying
  // the partial current-month accrual, for a chart point at maturity.
  const navSnapshotPlans: { takenAt: Date; valueUsdc: number }[] = distributionMonths.map((m) => ({
    takenAt: m,
    valueUsdc: round2(otherValueUsdc + principal),
  }));
  if (matured) {
    navSnapshotPlans.push({
      takenAt: truncateToUtcHour(now),
      valueUsdc: round2(otherValueUsdc + principal + accruedAfter),
    });
  }

  const ops: Prisma.PrismaPromise<unknown>[] = [
    // Scoped to THIS position's distribution rows only — never the opening
    // deposit (type="deposit"), never another position's rows.
    prisma.investorTransaction.deleteMany({ where: { positionId: target.id, type: "distribution" } }),
    // Scoped to rows THIS module created for THIS investor — never an
    // hourly-cron "computed" snapshot or a "dev_seed" fixture row.
    prisma.investorNavSnapshot.deleteMany({ where: { investorId, source: SNAPSHOT_SOURCE } }),
    prisma.position.update({
      where: { id: target.id },
      data: {
        subscribedAt: newSubscribedAt,
        accruedYieldUsdc: accruedAfter,
        distributedUsdc: distributedTotal,
        status: finalStatus,
        maturedAt,
        exitedAt: null,
      },
    }),
    prisma.investorTransaction.createMany({
      data: distributionMonths.map((occurredAt) => ({
        investorId,
        positionId: target.id,
        type: "distribution",
        amountUsdc: monthlyPayment,
        occurredAt,
      })),
    }),
    ...navSnapshotPlans.map((snap) =>
      prisma.investorNavSnapshot.upsert({
        where: { investorId_takenAt: { investorId, takenAt: snap.takenAt } },
        create: { investorId, takenAt: snap.takenAt, valueUsdc: snap.valueUsdc, source: SNAPSHOT_SOURCE },
        update: { valueUsdc: snap.valueUsdc, source: SNAPSHOT_SOURCE },
      }),
    ),
  ];

  await prisma.$transaction(ops, { timeout: TX_TIMEOUT_MS, maxWait: TX_MAX_WAIT_MS });

  return {
    ok: true,
    positionId: target.id,
    distributedUsdc: distributedTotal,
    accruedYieldUsdc: accruedAfter,
    status: finalStatus,
  };
}
