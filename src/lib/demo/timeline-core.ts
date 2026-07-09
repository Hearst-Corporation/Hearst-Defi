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

/**
 * Safety cap — any position aged by this module. Matches `MAX_SUBSCRIBE_USDC`
 * in src/lib/positions/subscribe-logic.ts (the real subscription cap) so a
 * realistic institutional ticket (e.g. $10-50M) never trips this guard — the
 * cap exists to catch a corrupt/garbage principal, not to constrain the demo.
 */
const MAX_PRINCIPAL_USDC = 1_000_000_000;

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
  /** Every position that was aged (all of the investor's active/matured positions). */
  positionIds: string[];
  /** Sum of distributedUsdc across every aged position (matches the aggregated cockpit total). */
  distributedUsdc: number;
  /** Sum of accruedYieldUsdc across every aged position. */
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
 * Resolve every position an age stage should act on: ALL of the investor's
 * active/matured positions (the cockpit aggregates across positions, so
 * aging only the most recent one leaves the header total and the
 * distribution history inconsistent — see advanceInvestorTimeline). Returns
 * an empty array when the investor has no active/matured position at all.
 */
async function resolveTargetPositions(prisma: PrismaClient, investorId: string) {
  return prisma.position.findMany({
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

  // Reset wipes to an EMPTY portfolio for every investor, Zand included. No
  // automatic fixture re-seed — "Reset (0)" means zero. The $2M Zand fixture is
  // re-created on demand only, via the CLI seed (prisma/seed-zand-demo.ts) or
  // the in-app Subscribe / Deposit buttons.
  return {
    ok: true,
    positionsDeleted: positionsCount,
    transactionsDeleted: transactionsCount,
    navSnapshotsDeleted: navSnapshotsCount,
  };
}

// ── advanceInvestorTimeline ──────────────────────────────────────────────

/**
 * Ages EVERY one of the investor's active/matured positions forward by
 * `months`, optionally marking each `matured` at the end. The cockpit
 * aggregates across all of an investor's positions (header total, combined
 * distribution history, combined NAV) — aging only the most-recent position
 * while leaving the others untouched used to desync that aggregate from what
 * the timeline actually produced. Each position is backdated/redistributed
 * independently using its OWN principal and APY, then the per-position NAV
 * contributions are summed into one investor-level snapshot per month, same
 * math as `runAgeStage`'s --execute path in scripts/demo/timeline.ts applied
 * per-position:
 *   - backdates `subscribedAt` to now − months (day-of-month clamped)
 *   - deletes then recreates each position's `distribution` transactions
 *     (idempotent — never touches the opening `deposit` row)
 *   - deletes then upserts this module's own NAV snapshots
 *     (source="demo_timeline" — never a cron "computed" or "dev_seed" row),
 *     one snapshot per month, valued as the SUM across all aged positions
 *   - sets `distributedUsdc` / `accruedYieldUsdc` per position from its own
 *     mid-APY monthly rate
 *   - sets `status`/`maturedAt` on every position when `matured` is requested
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

  const targets = await resolveTargetPositions(prisma, investorId);
  if (targets.length === 0) {
    throw new Error("No active/matured position found for this investor.");
  }

  const now = new Date();
  const finalStatus: FinalStatus = matured ? "matured" : "active";
  const maturedAt = matured ? now : null;
  const newSubscribedAt = addMonthsUtc(now, -months);

  // Distribution months: the last `months` completed 1st-of-month dates —
  // most recent distribution = the start of the current month; the partial
  // current-month accrual is what's accrued SINCE that distribution. Shared
  // across every position (they're all being aged by the same `months`).
  const nowFirstOfMonth = firstOfMonthUtc(now);
  const distributionMonths: Date[] = [];
  for (let monthsAgo = months - 1; monthsAgo >= 0; monthsAgo -= 1) {
    distributionMonths.push(addMonthsUtc(nowFirstOfMonth, -monthsAgo));
  }

  const dayOfMonth = now.getUTCDate();
  const daysInCurrentMonth = daysInUtcMonth(now.getUTCFullYear(), now.getUTCMonth());
  // Bounded at 50% so the "in progress" accrual reads as a small pending
  // amount, never as almost-a-full-month already earned but undistributed.
  const elapsedFraction = Math.min(dayOfMonth / daysInCurrentMonth, 0.5);

  interface PerPositionPlan {
    id: string;
    principal: number;
    monthlyPayment: number;
    distributedTotal: number;
    accruedAfter: number;
  }

  const plans: PerPositionPlan[] = targets.map((target) => {
    const principal = toNumber(target.principalUsdc);
    assertPrincipalWithinCap(principal);
    const { midApyPct } = resolveApyBps(target);
    const monthlyPayment = round2((principal * (midApyPct / 100)) / 12);
    const distributedTotal = round2(monthlyPayment * months);
    const accruedAfter = round2(monthlyPayment * elapsedFraction);
    return { id: target.id, principal, monthlyPayment, distributedTotal, accruedAfter };
  });

  // Investor-level NAV per distribution month — SUM of every aged position's
  // principal (yield is DISTRIBUTED not capitalized, so each position's
  // "just distributed" value is flat at its own principal). When `matured`,
  // append one final snapshot at `now` carrying the SUM of every position's
  // partial current-month accrual, for a chart point at maturity.
  const principalSum = round2(plans.reduce((sum, p) => sum + p.principal, 0));
  const accruedSum = round2(plans.reduce((sum, p) => sum + p.accruedAfter, 0));
  const distributedSum = round2(plans.reduce((sum, p) => sum + p.distributedTotal, 0));

  const navSnapshotPlans: { takenAt: Date; valueUsdc: number }[] = distributionMonths.map((m) => ({
    takenAt: m,
    valueUsdc: principalSum,
  }));
  if (matured) {
    navSnapshotPlans.push({
      takenAt: truncateToUtcHour(now),
      valueUsdc: round2(principalSum + accruedSum),
    });
  }

  const ops: Prisma.PrismaPromise<unknown>[] = [
    // Scoped to THESE positions' distribution rows only — never the opening
    // deposit (type="deposit"), never another investor's rows.
    prisma.investorTransaction.deleteMany({
      where: { positionId: { in: plans.map((p) => p.id) }, type: "distribution" },
    }),
    // Scoped to rows THIS module created for THIS investor — never an
    // hourly-cron "computed" snapshot or a "dev_seed" fixture row.
    prisma.investorNavSnapshot.deleteMany({ where: { investorId, source: SNAPSHOT_SOURCE } }),
    ...plans.map((plan) =>
      prisma.position.update({
        where: { id: plan.id },
        data: {
          subscribedAt: newSubscribedAt,
          accruedYieldUsdc: plan.accruedAfter,
          distributedUsdc: plan.distributedTotal,
          status: finalStatus,
          maturedAt,
          exitedAt: null,
        },
      }),
    ),
    ...plans.map((plan) =>
      prisma.investorTransaction.createMany({
        data: distributionMonths.map((occurredAt) => ({
          investorId,
          positionId: plan.id,
          type: "distribution",
          amountUsdc: plan.monthlyPayment,
          occurredAt,
        })),
      }),
    ),
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
    positionIds: plans.map((p) => p.id),
    distributedUsdc: distributedSum,
    accruedYieldUsdc: accruedSum,
    status: finalStatus,
  };
}
