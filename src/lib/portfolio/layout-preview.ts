import type { DistribEntry } from "@/components/portfolio/distrib-calendar";
import type { LockMeterProps } from "@/components/portfolio/lock-meter";
import type { ProofPulseProps } from "@/components/portfolio/proof-pulse";
import type { RiskPulseProps } from "@/components/portfolio/risk-pulse";
import type { TimeToCashProps } from "@/lib/data/time-to-cash";
import type { YieldStackProps } from "@/components/portfolio/yield-stack";
import { METHODOLOGY_VERSION } from "@/lib/engine/methodology";
import { DEMO_YIELD_VAULT_ID } from "@/lib/dev/investor-demo";

/** Invest route used by cold-start surfaces (e.g. proof center). */
export const PORTFOLIO_ONBOARDING_INVEST_HREF = `/vaults/${DEMO_YIELD_VAULT_ID}/invest`;

/** Portfolio renders preview/empty surfaces when the LP has no active position. */
export function isLayoutPreview(hasPositions: boolean): boolean {
  return !hasPositions;
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

/** Composite must not display when every dimension is still N/A. */
export function isRiskCompositeUnavailable(props: RiskPulseProps): boolean {
  const dimensionsPopulated = props.scores.some((s) => s.score > 0);
  return isRiskPulseEmpty(props) || !dimensionsPopulated;
}

export function isProofPulseEmpty(props: ProofPulseProps): boolean {
  return (
    props.lastPor.statedTvlUsdc === 0 && props.lastPor.onChainTvlUsdc === 0
  );
}
