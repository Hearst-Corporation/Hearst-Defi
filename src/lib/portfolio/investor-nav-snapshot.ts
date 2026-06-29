import "server-only";

import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import type { HourlyValueSnapshot } from "@/lib/portfolio/value-series";

const HOUR_MS = 60 * 60 * 1000;

/** UTC hour bucket — one print per investor per hour. */
export function truncateToUtcHour(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), 0, 0, 0),
  );
}

function toNumber(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return parseFloat(v);
  if (v !== null && typeof v === "object" && "toNumber" in v) {
    return (v as { toNumber(): number }).toNumber();
  }
  return 0;
}

/**
 * Live investor NAV = Σ (principal + accrued) across active/matured positions.
 * Exited positions are excluded — they no longer contribute to portfolio value.
 */
export async function computeInvestorNavUsdc(investorId: string): Promise<number | null> {
  const positions = await prisma.position.findMany({
    where: { investorId, status: { in: ["active", "matured"] } },
    select: { principalUsdc: true, accruedYieldUsdc: true },
  });

  if (positions.length === 0) return null;

  return positions.reduce(
    (sum, p) => sum + toNumber(p.principalUsdc) + toNumber(p.accruedYieldUsdc),
    0,
  );
}

const DAY_MS = 24 * HOUR_MS;
const RECONSTRUCT_MAX_POINTS = 366;

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

/**
 * Deterministically reconstruct an investor's NAV value path from REAL position
 * anchors, for the chart when no/sparse hourly prints exist yet (fresh account,
 * dev, or pre-cron migration). Per active/matured position the value climbs from
 * 0 at `subscribedAt` (capital just deployed) to `principal + accruedYieldUsdc` —
 * its current real NAV contribution (same definition as {@link
 * computeInvestorNavUsdc}) — at `now`, by a straight line. So the portfolio reads
 * as a real climb from ZERO up to its current value (0 → $11, 0 → $500k), which
 * pairs with the chart's zero-baseline y-axis. The current value is real; the
 * ramp between is the estimate. A position contributes 0 before its subscription
 * date (capital not deployed yet).
 *
 * Returns `[]` when the investor has no contributing position — zero stays zero.
 * This is a DERIVED series (not a live print): callers should treat NAV
 * provenance as estimated, never live.
 */
export async function reconstructInvestorNavSeries(
  investorId: string,
  since: Date,
  now: Date = new Date(),
): Promise<HourlyValueSnapshot[]> {
  const positions = await prisma.position.findMany({
    where: { investorId, status: { in: ["active", "matured"] } },
    select: { principalUsdc: true, accruedYieldUsdc: true, subscribedAt: true },
  });
  if (positions.length === 0) return [];

  const anchors = positions.map((p) => ({
    principal: toNumber(p.principalUsdc),
    accrued: toNumber(p.accruedYieldUsdc),
    start: p.subscribedAt.getTime(),
  }));

  const nowMs = now.getTime();
  const earliestStart = Math.min(...anchors.map((a) => a.start));
  const startMs = Math.max(since.getTime(), earliestStart);

  // Reconstruct each position's value as the SUM of two real, differently-shaped
  // components rather than one flat linear ramp (which renders as a featureless
  // diagonal). Both share the same anchors and still climb 0 → full current NAV:
  //   • principal — capital deployed near the start, so it rises fast then
  //     saturates (concave: a √-ease, reaching its full value by ~mid-window);
  //   • accrued yield — compounds over the holding period, so it rises slowly
  //     then accelerates (convex: ratio²).
  // Sum = a natural S/relief curve instead of a straight line. Invariants hold:
  // value(start)=0, value(now)=principal+accrued, monotonic non-decreasing.
  const valueAt = (tMs: number): number =>
    anchors.reduce((sum, a) => {
      if (tMs < a.start) return sum; // capital not deployed yet
      const denom = nowMs - a.start;
      const ratio = denom <= 0 ? 1 : Math.min(1, Math.max(0, (tMs - a.start) / denom));
      const principalShape = Math.sqrt(ratio); // fast deploy, then saturates
      const yieldShape = ratio * ratio; // compounding accrual, accelerating
      return sum + a.principal * principalShape + a.accrued * yieldShape;
    }, 0);

  // Degenerate range (all subscriptions at/after `now`, or window collapsed):
  // emit a single honest point at the current real NAV.
  if (startMs >= nowMs) {
    return [{ at: new Date(nowMs), valueUsdc: round2(valueAt(nowMs)) }];
  }

  const spanMs = nowMs - startMs;
  const steps = Math.min(RECONSTRUCT_MAX_POINTS, Math.max(2, Math.ceil(spanMs / DAY_MS)));
  const series: HourlyValueSnapshot[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const tMs = startMs + (spanMs * i) / steps;
    series.push({ at: new Date(Math.round(tMs)), valueUsdc: round2(valueAt(tMs)) });
  }
  return series;
}

export type CaptureNavResult =
  | { skipped: true; reason: "no_positions" }
  | { snapshotId: string; valueUsdc: number; takenAt: Date };

/**
 * Persist one hourly NAV print for an investor. Upserts on (investorId, takenAt hour).
 * Does not invent history — only records the value read at capture time.
 */
export async function captureInvestorNavSnapshot(
  investorId: string,
  at: Date = new Date(),
  source: "computed" | "dev_seed" = "computed",
): Promise<CaptureNavResult> {
  const valueUsdc = await computeInvestorNavUsdc(investorId);
  if (valueUsdc === null) {
    return { skipped: true, reason: "no_positions" };
  }

  const takenAt = truncateToUtcHour(at);

  const row = await prisma.investorNavSnapshot.upsert({
    where: { investorId_takenAt: { investorId, takenAt } },
    create: { investorId, takenAt, valueUsdc, source },
    update: { valueUsdc, source },
  });

  return { snapshotId: row.id, valueUsdc, takenAt };
}

/** Snapshot all investors with at least one active/matured position. */
export async function captureAllInvestorNavSnapshots(
  at: Date = new Date(),
): Promise<{ captured: number; skipped: number }> {
  const investors = await prisma.investor.findMany({
    where: { positions: { some: { status: { in: ["active", "matured"] } } } },
    select: { id: true },
  });

  let captured = 0;
  let skipped = 0;

  for (const { id } of investors) {
    const result = await captureInvestorNavSnapshot(id, at);
    if ("skipped" in result) {
      skipped += 1;
    } else {
      captured += 1;
    }
  }

  logger.info("[investor-nav-snapshot] hourly capture complete", {
    captured,
    skipped,
    at: truncateToUtcHour(at).toISOString(),
  });

  return { captured, skipped };
}

function isMissingInvestorNavSnapshotTable(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: string }).code === "P2021"
  );
}

/** Load persisted hourly prints for the portfolio value chart (max ~1 year). */
export async function loadHourlyValueSnapshots(
  investorId: string,
  since: Date,
): Promise<HourlyValueSnapshot[]> {
  try {
    const rows = await prisma.investorNavSnapshot.findMany({
      where: { investorId, takenAt: { gte: since } },
      orderBy: { takenAt: "asc" },
      select: { takenAt: true, valueUsdc: true },
      take: 8760 + 1,
    });

    return rows.map((r) => ({
      at: r.takenAt,
      valueUsdc: toNumber(r.valueUsdc),
    }));
  } catch (err) {
    if (isMissingInvestorNavSnapshotTable(err)) {
      logger.warn(
        "[investor-nav-snapshot] InvestorNavSnapshot table missing — chart falls back to ledger_sparse until migration is applied",
      );
      return [];
    }
    throw err;
  }
}
