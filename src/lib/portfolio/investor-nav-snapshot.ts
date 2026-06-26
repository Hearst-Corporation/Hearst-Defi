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

export { HOUR_MS as INVESTOR_NAV_HOUR_MS };
