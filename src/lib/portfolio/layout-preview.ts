import type { DistribEntry } from "@/components/portfolio/distrib-calendar";
import type { LockMeterProps } from "@/components/portfolio/lock-meter";
import type { ProofPulseProps } from "@/components/portfolio/proof-pulse";
import type { RiskPulseProps } from "@/components/portfolio/risk-pulse";
import type { TimeToCashProps } from "@/components/portfolio/time-to-cash";
import type { YieldStackProps } from "@/components/portfolio/yield-stack";
import { METHODOLOGY_VERSION } from "@/lib/engine/methodology";

/** Portfolio renders preview/empty surfaces when the LP has no active position. */
export function isLayoutPreview(hasPositions: boolean): boolean {
  return !hasPositions;
}

/** Surface tier for portfolio sections — active when positions exist, else preview. */
export type PortfolioSurfaceState = "active" | "preview";

export function resolvePortfolioSurfaceState(
  hasActivePosition: boolean,
): PortfolioSurfaceState {
  return hasActivePosition ? "active" : "preview";
}

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** Flat $0 chart series for the 12-month value chart (layout preview only). */
export function buildZeroValueChartSeries(asOf: Date): Array<{
  label: string;
  value: number;
  isDistribution: boolean;
}> {
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(
      Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth() - (11 - i), 1),
    );
    return {
      label: MONTH_LABELS[d.getUTCMonth() % 12] ?? "",
      value: 0,
      isDistribution: false,
    };
  });
}

/** Twelve $0 payout bars for the distribution calendar (layout preview only). */
export function buildZeroDistribEntries(refYear: number): DistribEntry[] {
  return Array.from({ length: 12 }, (_, i) => ({
    period: `${refYear}-${String(i + 1).padStart(2, "0")}`,
    amountUsdc: 0,
    paidAt: null,
  }));
}

export const ZERO_YIELD_STACK: YieldStackProps = {
  sources: [
    { bucket: "mining", label: "Mining cashflow", contributionPct: 0 },
    { bucket: "usdc_base", label: "USDC base yield", contributionPct: 0 },
    {
      bucket: "btc_tactical",
      label: "BTC tactical",
      contributionPct: 0,
      isVolatile: true,
    },
    { bucket: "stable_reserve", label: "Stable reserve", contributionPct: 0 },
  ],
  blendedLow: 0,
  blendedHigh: 0,
  stressedBearRange: { low: 0, high: 0 },
  methodologyVersion: METHODOLOGY_VERSION,
  source: "stale",
};

export function zeroLockMeterProps(asOf: Date): LockMeterProps {
  return {
    lockStart: asOf,
    softLockupDays: 60,
    earlyExitPenaltyBps: 150,
    asOf,
    source: "stale",
  };
}

export function zeroTimeToCashProps(asOf: Date): TimeToCashProps {
  return {
    cycleStart: new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), 1)),
    cycleDays: 30,
    projectedUsdc: 0,
    aprLow: 0,
    aprHigh: 0,
    asOf,
    source: "stale",
  };
}

export function zeroProofPulseProps(asOf: Date): ProofPulseProps {
  return {
    lastPor: { timestamp: asOf, statedTvlUsdc: 0, onChainTvlUsdc: 0 },
    methodologyVersion: METHODOLOGY_VERSION,
    methodologyLocked: true,
    nextAttestation: null,
    auditor: "",
    source: "stale",
  };
}

export function isRiskPulseEmpty(props: RiskPulseProps): boolean {
  return (
    props.compositeLabel === undefined &&
    props.composite === 0 &&
    props.scores.every((s) => s.score === 0)
  );
}

export function isProofPulseEmpty(props: ProofPulseProps): boolean {
  return (
    props.lastPor.statedTvlUsdc === 0 && props.lastPor.onChainTvlUsdc === 0
  );
}
