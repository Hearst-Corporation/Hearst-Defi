import type { AllocationBucket } from "@/lib/engine/types";

export interface VaultKpiFacts {
  apyLow: number;
  apyHigh: number;
  mgmtFeeBps: number;
  perfFeeBps: number;
  softLockupDays: number;
  capacityUsdc: number;
  currentAumUsdc: number;
}

export interface VaultLegalFacts {
  strategy: string;
  spvJurisdiction: string;
  shareClass: string;
  regExemption: string;
  minTicketUsdc: number;
}

export interface VaultAllocationFacts {
  targetMiningBps: number;
  targetBtcTacticalBps: number;
  targetUsdcBaseBps: number;
  targetStableReserveBps: number;
}

export const ALLOCATION_BUCKETS: AllocationBucket[] = [
  "mining",
  "btc_tactical",
  "usdc_base",
  "stable_reserve",
];

export const ALLOCATION_ADMIN_LABELS: Record<AllocationBucket, string> = {
  mining: "Mining",
  btc_tactical: "BTC Tactical",
  usdc_base: "USDC Base",
  stable_reserve: "Stable Reserve",
};

export const ALLOCATION_INVESTOR_LABELS: Record<AllocationBucket, string> = {
  mining: "Bitcoin Mining Operations",
  btc_tactical: "BTC Tactical Delta",
  usdc_base: "USDC Base Lending",
  stable_reserve: "Stable Reserve",
};

export const ALLOCATION_DESCRIPTIONS: Record<AllocationBucket, string> = {
  mining:
    "Directly deployed hashrate — revenue share from partner mining facilities.",
  btc_tactical:
    "Spot BTC exposure for directional upside within a realised-volatility guardrail.",
  usdc_base: "T-bills + on-chain lending weighted average.",
  stable_reserve: "USDC yield buffer for soft lock-up and redemption queue.",
};

type KpiSource = {
  apyLow?: number;
  apyHigh?: number;
  targetApyLowBps?: number;
  targetApyHighBps?: number;
  mgmtFeeBps: number;
  perfFeeBps: number;
  softLockupDays: number;
  capacityUsdc: number;
  currentAumUsdc?: number;
  aumUsdc?: number;
};

type LegalSource = {
  strategy: string;
  spvJurisdiction: string;
  shareClass: string;
  regExemption: string;
  minTicketUsdc: number;
};

type AllocationSource = VaultAllocationFacts;

export function bpsToPercent(bps: number, precision: 0 | 1 = 1): string {
  return (bps / 100).toFixed(precision);
}

export function allocationBps(
  facts: VaultAllocationFacts,
  bucket: AllocationBucket,
): number {
  switch (bucket) {
    case "mining":
      return facts.targetMiningBps;
    case "btc_tactical":
      return facts.targetBtcTacticalBps;
    case "usdc_base":
      return facts.targetUsdcBaseBps;
    case "stable_reserve":
      return facts.targetStableReserveBps;
  }
}

export function toVaultKpiFacts(source: KpiSource): VaultKpiFacts {
  const apyLow =
    source.apyLow ?? Number(source.targetApyLowBps ?? 0) / 100;
  const apyHigh =
    source.apyHigh ?? Number(source.targetApyHighBps ?? 0) / 100;

  return {
    apyLow,
    apyHigh,
    mgmtFeeBps: source.mgmtFeeBps,
    perfFeeBps: source.perfFeeBps,
    softLockupDays: source.softLockupDays,
    capacityUsdc: Number(source.capacityUsdc),
    currentAumUsdc: Number(source.currentAumUsdc ?? source.aumUsdc ?? 0),
  };
}

export function toVaultLegalFacts(source: LegalSource): VaultLegalFacts {
  return {
    strategy: source.strategy,
    spvJurisdiction: source.spvJurisdiction,
    shareClass: source.shareClass,
    regExemption: source.regExemption,
    minTicketUsdc: Number(source.minTicketUsdc),
  };
}

export function toVaultAllocationFacts(
  source: AllocationSource,
): VaultAllocationFacts {
  return {
    targetMiningBps: source.targetMiningBps,
    targetBtcTacticalBps: source.targetBtcTacticalBps,
    targetUsdcBaseBps: source.targetUsdcBaseBps,
    targetStableReserveBps: source.targetStableReserveBps,
  };
}
