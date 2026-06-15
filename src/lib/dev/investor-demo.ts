/**
 * Investor demo seed — dev/staging visual QA only (not production data).
 *
 * Inserts clearly-labelled demo rows for test@hearst.local so investor pages
 * can be reviewed with populated layouts. Never weakens provenance guards.
 */

/** Visible in DB notes / console — unmistakable staging marker. */
export const DEMO_MARKER = "DEMO / local visual QA — not production";

export const DEMO_INVESTOR_EMAIL = "test@hearst.local";

/** Base Sepolia PoR registry — real testnet deployment (not 0x00…00N placeholder). */
export const DEMO_YIELD_VAULT_CONTRACT =
  "0x2B7229Ea0c94f12D984d9045ee12fB0D2Efcd28D" as const;

export const DEMO_YIELD_VAULT_ID = "hearst-yield-vault";

export const DEMO_POSITION_ID = "demo-investor-position-hyv";

export const DEMO_WALLET = "0x1111111111111111111111111111111111111111" as const;

export const DEMO_VAULT_KEY = "hearst-yield-vault:class-A";

/**
 * Legacy fabricated tx hashes from older demo seeds. Demo rows are now created
 * with `txHash: null` (no fake explorer links — D4), so these are retained ONLY
 * to purge historical 0xfeed… fixtures via deleteMany in the seed script.
 */
export const DEMO_TX_HASHES = {
  deposit: "0xfeed000000000000000000000000000000000000000000000000000000000001",
  distribution1: "0xfeed000000000000000000000000000000000000000000000000000000000002",
  distribution2: "0xfeed000000000000000000000000000000000000000000000000000000000003",
  distribution3: "0xfeed000000000000000000000000000000000000000000000000000000000004",
} as const;

export function canSeedInvestorDemo(
  nodeEnv: string | undefined = process.env.NODE_ENV,
  allowFlag: string | undefined = process.env.ALLOW_INVESTOR_DEMO_SEED,
): boolean {
  if (nodeEnv !== "production") return true;
  return allowFlag === "true";
}

export interface DemoPositionRow {
  id: string;
  investorId: string;
  vaultDeploymentId: string;
  vaultKey: string;
  principalUsdc: number;
  accruedYieldUsdc: number;
  distributedUsdc: number;
  subscribedAt: Date;
  txHashOpen: string | null;
}

export function buildDemoPosition(
  investorId: string,
  subscribedAt: Date,
): DemoPositionRow {
  return {
    id: DEMO_POSITION_ID,
    investorId,
    vaultDeploymentId: DEMO_YIELD_VAULT_ID,
    vaultKey: DEMO_VAULT_KEY,
    principalUsdc: 500_000,
    accruedYieldUsdc: 42_000,
    distributedUsdc: 18_000,
    subscribedAt,
    // D4: no fabricated tx hash — a null open hash renders the position without
    // a dead BaseScan link (the explorer anchor is gated on a truthy hash).
    txHashOpen: null,
  };
}

export interface DemoVaultSnapshotRow {
  aumUsdc: number;
  currentApyLow: number;
  currentApyHigh: number;
  stressedApy: number;
  riskScore: number;
  miningMarginScore: number;
  mode: string;
  source: string;
  takenAt: Date;
}

export function buildDemoVaultSnapshot(asOf: Date): DemoVaultSnapshotRow {
  return {
    takenAt: asOf,
    aumUsdc: 25_000_000,
    currentApyLow: 9.4,
    currentApyHigh: 12.8,
    stressedApy: 5.6,
    riskScore: 42,
    miningMarginScore: 78,
    mode: "balanced",
    source: "demo-staging",
  };
}

export const DEMO_ALLOCATION_BUCKETS = [
  { bucket: "mining", pct: 60, yieldContributionBps: 540 },
  { bucket: "btc_tactical", pct: 15, yieldContributionBps: 180 },
  { bucket: "usdc_base", pct: 15, yieldContributionBps: 90 },
  { bucket: "stable_reserve", pct: 10, yieldContributionBps: 60 },
] as const;
