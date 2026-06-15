// Demo builder — admin distributions page.
//
// Pure, deterministic. No Prisma, no fetch, no I/O.
// Returns the same row shape that `prisma.distribution.findMany` produces so
// the page can consume it identically.
//
// Honesty contract:
//   txHash MUST start with "0xMOCK_" so the page's own sentinel check renders
//   the Source column as "estimated" (ProvenanceBadge) and the Tx hash column
//   as "simulated" — NEVER "attested".  No real on-chain hash is used here.
//
// Capital assumption: $25 000 000 AUM, monthly yield at ~0.8 % → ~$200 000/month.

// Structural type that satisfies the page's `d.amountUsdc.toNumber()` call
// without importing the Prisma client (which requires a generated client).
interface DecimalLike {
  toNumber(): number;
}

export interface DemoDistributionRow {
  id: string;
  distributedAt: Date;
  amountUsdc: DecimalLike;
  txHash: string | null;
  recipientsCount: number;
  period: string;
  vaultRef: string | null;
}

// Month offset → stable mock row. Most recent first (matches `orderBy: { distributedAt: "desc" }`).
const DEMO_ROWS: ReadonlyArray<{
  readonly period: string;
  readonly amountUsdc: number;
  readonly recipientsCount: number;
}> = [
  { period: "2026-05", amountUsdc: 203_412.5, recipientsCount: 18 },
  { period: "2026-04", amountUsdc: 197_880.0, recipientsCount: 17 },
  { period: "2026-03", amountUsdc: 201_250.0, recipientsCount: 17 },
  { period: "2026-02", amountUsdc: 189_600.0, recipientsCount: 16 },
  { period: "2026-01", amountUsdc: 194_375.0, recipientsCount: 15 },
  { period: "2025-12", amountUsdc: 208_100.0, recipientsCount: 15 },
];

/** Wraps a plain number as a `DecimalLike` to satisfy `d.amountUsdc.toNumber()`. */
function decimal(value: number): DecimalLike {
  return { toNumber: () => value };
}

/**
 * Build the last-6 distribution history for the demo provider.
 *
 * Distribution dates are computed from each row's period string directly
 * (last calendar day of the month, noon UTC) — no anchor date needed.
 */
export function buildDemoDistributions(): DemoDistributionRow[] {
  return DEMO_ROWS.map((row, idx) => {
    // distributedAt = last calendar day of the period month, noon UTC.
    const parts = row.period.split("-");
    const year = Number(parts[0]);
    const month = Number(parts[1]);
    // Date.UTC(year, month, 0) → last day of the given month.
    const distributedAt = new Date(Date.UTC(year, month, 0, 12, 0, 0));

    return {
      id: `demo-dist-${idx + 1}`,
      distributedAt,
      amountUsdc: decimal(row.amountUsdc),
      // 0xMOCK_ prefix → page renders "simulated" / "estimated", never "attested".
      txHash: `0xMOCK_DIST_${row.period.replace("-", "")}`,
      recipientsCount: row.recipientsCount,
      period: row.period,
      vaultRef: "hearst-yield-vault",
    };
  });
}
