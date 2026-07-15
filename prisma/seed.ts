import { makePrismaClient } from "../scripts/lib/prisma-cli";
// `@node-rs/argon2` is imported directly here (not via src/lib/auth/password.ts)
// because that module is `server-only` and would throw under `tsx`. Params must
// stay in sync with password.ts (OWASP argon2id: 19 MiB, t=2, p=1, Argon2id=2).
import { hash } from "@node-rs/argon2";
import { computeMiningRevenue } from "../src/lib/engine/mining";
import {
  MOCK_ATTESTOR_ADDRESS,
  signMockAttestation,
} from "../src/lib/attestation/mock";
import type {
  BacktestKey,
  Preset,
  ScenarioInputs,
  ScenarioOutput,
} from "../src/lib/engine/types";
import {
  VAULT_BTC_PLUS,
  VAULT_DEFENSIVE,
  VAULT_YIELD,
  type VaultDefinition,
} from "../src/lib/engine/vaults";
import { SHARE_CLASS_A, SHARE_CLASS_B } from "../src/lib/engine/share-class";
import { getDeployment } from "../src/lib/chain/deployments";

const prisma = makePrismaClient();

const AUM_USDC = 25_000_000;

// Seed anchored on the real "now" so freshness windows (e.g. the dashboard's
// 30-day trailing filter) always hold after a re-seed. Every other date below
// was authored against the original 2026-05-14 anchor; we shift them all by the
// same delta so their *relative* spacing/order is preserved exactly.
const SEED_ANCHOR_ORIGINAL = new Date("2026-05-14T00:00:00Z");
const SEED_NOW = new Date();
const SEED_SHIFT_MS = SEED_NOW.getTime() - SEED_ANCHOR_ORIGINAL.getTime();

/** Shift an originally-authored fixed date onto the live anchor. */
function shifted(d: Date): Date {
  return new Date(d.getTime() + SEED_SHIFT_MS);
}

// ---------------------------------------------------------------------------
// Daily timeline — 30 days back from SEED_NOW.
// AUM grows 8M -> 12M, APY oscillates 9-13%, allocations stay near balanced.
// ---------------------------------------------------------------------------

const DAILY_WINDOW_DAYS = 30;
const DAILY_AUM_START = 8_000_000;
const DAILY_AUM_END = 12_000_000;

const PRESETS: Preset[] = [
  "base",
  "btc_bear",
  "btc_bull",
  "mining_compression",
  "extreme_stress",
];
const BACKTEST_KEYS: BacktestKey[] = [
  "bear_2022",
  "etf_halving_2024",
  "mining_crunch_2024",
];

// Preset/scenario snapshots are anchored ~90 days in the past so they sit well
// outside the dashboard's 30-day trailing window. They feed the memo/scenario
// loaders (which query by preset), never the live dashboard KPIs.
const PRESET_ANCHOR = new Date(SEED_NOW.getTime() - 90 * 24 * 60 * 60 * 1000);
const presetDate = (offsetDays: number): Date =>
  new Date(PRESET_ANCHOR.getTime() + offsetDays * 24 * 60 * 60 * 1000);

const SNAPSHOT_DATES: Record<Preset, Date> = {
  base: presetDate(0),
  btc_bear: presetDate(1),
  btc_bull: presetDate(2),
  mining_compression: presetDate(3),
  extreme_stress: presetDate(4),
};

// Base mining inputs for the dev seed (was getPresetInputs("base"); the v1.0
// scenario engine was removed). Plain literal — only feeds the KEPT mining
// revenue calc (src/lib/engine/mining.ts) for MiningMetric seed rows.
const MINING_BASE_INPUTS: ScenarioInputs = {
  btc_price_change_pct: 0,
  hashprice_usd_th_day: 0.06,
  energy_cost_kwh: 0.05,
  stable_apy_pct: 8,
  vol_index: 45,
};

const APPROVED_BY = JSON.stringify(["multisig:0xAAA", "multisig:0xBBB"]);

interface RebalanceFixture {
  ruleId: string;
  executedAt: Date;
  triggerText: string;
  actionText: string;
  impactText: string;
  fromAllocation: Record<string, number>;
  toAllocation: Record<string, number>;
}

const REBALANCE_FIXTURES: RebalanceFixture[] = [
  {
    ruleId: "R1",
    executedAt: shifted(new Date("2026-03-14T15:00:00Z")),
    triggerText: "Risk score crossed 65 threshold (current: 68)",
    actionText: "Shift 5% AUM btc_tactical -> usdc_base",
    impactText: "Lowers volatility exposure; APY low slips to 8.9%",
    fromAllocation: { mining: 35, btc_tactical: 20, usdc_base: 35, stable_reserve: 10 },
    toAllocation: { mining: 35, btc_tactical: 15, usdc_base: 40, stable_reserve: 10 },
  },
  {
    ruleId: "R2",
    executedAt: shifted(new Date("2026-03-29T15:00:00Z")),
    triggerText: "Mining margin dropped below 60 (current: 54)",
    actionText: "Rotate 8% AUM mining -> usdc_base",
    impactText: "Reduces hashprice exposure; stabilizes APY low at 9.1%",
    fromAllocation: { mining: 35, btc_tactical: 15, usdc_base: 40, stable_reserve: 10 },
    toAllocation: { mining: 27, btc_tactical: 15, usdc_base: 48, stable_reserve: 10 },
  },
  {
    ruleId: "R3",
    executedAt: shifted(new Date("2026-04-13T15:00:00Z")),
    triggerText: "BTC drawdown -22% with vol_index 38 (accumulate window)",
    actionText: "Convert 5% AUM usdc_base -> btc_tactical",
    impactText: "Builds BTC exposure into weakness; target reverts to balanced",
    fromAllocation: { mining: 27, btc_tactical: 15, usdc_base: 48, stable_reserve: 10 },
    toAllocation: { mining: 27, btc_tactical: 20, usdc_base: 43, stable_reserve: 10 },
  },
  {
    ruleId: "R4",
    executedAt: shifted(new Date("2026-04-22T15:00:00Z")),
    triggerText: "Hashprice 30d avg trending -3.4% vs 60d (watchlist band)",
    actionText: "No allocation change. Operational confidence steady at 81.",
    impactText: "APY range unchanged. Continue monitoring; review trigger at -5%.",
    fromAllocation: { mining: 27, btc_tactical: 20, usdc_base: 43, stable_reserve: 10 },
    toAllocation: { mining: 27, btc_tactical: 20, usdc_base: 43, stable_reserve: 10 },
  },
  {
    ruleId: "R5",
    executedAt: shifted(new Date("2026-04-28T15:00:00Z")),
    triggerText: "Mode shifted defensive -> balanced (risk 58, margin 72)",
    actionText: "Rebalance to balanced mode targets",
    impactText: "Restores mining weight; APY range widens to 9.8-12.4%",
    fromAllocation: { mining: 27, btc_tactical: 20, usdc_base: 43, stable_reserve: 10 },
    toAllocation: { mining: 35, btc_tactical: 15, usdc_base: 40, stable_reserve: 10 },
  },
  {
    ruleId: "R-DIST-1",
    executedAt: shifted(new Date("2026-05-01T09:00:00Z")),
    triggerText: "Distribution window 2026-04 closed; attestation v1 received.",
    actionText: "Distribute $179,400 USDC pro-rata to LP shares.",
    impactText: "Realised APY April = 8.8% annualised. Distribution-to-date $1.04M.",
    fromAllocation: { mining: 35, btc_tactical: 15, usdc_base: 40, stable_reserve: 10 },
    toAllocation: { mining: 35, btc_tactical: 15, usdc_base: 40, stable_reserve: 10 },
  },
  {
    ruleId: "R-BTC-3",
    executedAt: shifted(new Date("2026-05-05T11:10:00Z")),
    triggerText:
      "R-BTC-3 evaluated — BTC 91,800 vs avg entry 58,420 (ratio 1.57, > 1.30) but sleeve < 10% AUM gate not met.",
    actionText: "No execution. Trigger queued; awaiting sleeve > 10% AUM precondition.",
    impactText: "BTC tactical exposure preserved. Next evaluation on next price tick.",
    fromAllocation: { mining: 35, btc_tactical: 15, usdc_base: 40, stable_reserve: 10 },
    toAllocation: { mining: 35, btc_tactical: 15, usdc_base: 40, stable_reserve: 10 },
  },
  {
    ruleId: "R6",
    executedAt: shifted(new Date("2026-05-12T15:00:00Z")),
    triggerText: "Vol index above 80 sustained 7 days (current: 84)",
    actionText: "Reduce btc_tactical to 50% of mode target",
    impactText: "Caps downside; APY low trims by 30 bps",
    fromAllocation: { mining: 35, btc_tactical: 15, usdc_base: 40, stable_reserve: 10 },
    toAllocation: { mining: 35, btc_tactical: 7, usdc_base: 48, stable_reserve: 10 },
  },
];

interface ProofFixture {
  proofType: string;
  period: string | null;
  postedAt: Date;
  seed: string;
}

const PROOF_FIXTURES: ProofFixture[] = [
  { proofType: "mining_attestation", period: "2026-02", postedAt: shifted(new Date("2026-03-03T09:00:00Z")), seed: "mining-2026-02" },
  { proofType: "mining_attestation", period: "2026-03", postedAt: shifted(new Date("2026-04-03T09:00:00Z")), seed: "mining-2026-03" },
  { proofType: "mining_attestation", period: "2026-04", postedAt: shifted(new Date("2026-05-03T09:00:00Z")), seed: "mining-2026-04" },
  { proofType: "mining_attestation", period: "2026-05-week1", postedAt: shifted(new Date("2026-05-08T09:00:00Z")), seed: "mining-2026-05w1" },
  { proofType: "custody", period: "2026-03", postedAt: shifted(new Date("2026-04-05T09:00:00Z")), seed: "custody-2026-03" },
  { proofType: "custody", period: "2026-04", postedAt: shifted(new Date("2026-05-05T09:00:00Z")), seed: "custody-2026-04" },
  { proofType: "custody", period: "2026-05-mid", postedAt: shifted(new Date("2026-05-13T09:00:00Z")), seed: "custody-2026-05-mid" },
  { proofType: "audit", period: "2026-Q1", postedAt: shifted(new Date("2026-04-10T09:00:00Z")), seed: "audit-2026-Q1" },
  { proofType: "audit", period: "2026-Q2", postedAt: shifted(new Date("2026-05-10T09:00:00Z")), seed: "audit-2026-Q2" },
  { proofType: "methodology", period: null, postedAt: shifted(new Date("2026-01-15T09:00:00Z")), seed: "methodology-v1.0" },
  { proofType: "methodology", period: null, postedAt: shifted(new Date("2026-04-20T09:00:00Z")), seed: "methodology-v1.0-addendum" },
];

interface DistributionFixture {
  distributedAt: Date;
  period: string;
  amountUsdc: number;
  txHash: string | null;
  recipientsCount: number;
}

// 4 monthly distributions: Feb, Mar, Apr paid; May scheduled.
// D8: the "paid" rows carry a recognisable SEED SENTINEL hash (0x5eed…), not a
// plausible-looking fabricated hash. The admin distribution loader derives
// status from a non-null txHash (paid), so "paid" is preserved — but the
// sentinel is detected by isPlaceholderTxHash() so no UI renders a dead BaseScan
// link to a transaction that does not exist on-chain.
const DISTRIBUTION_FIXTURES: DistributionFixture[] = [
  {
    distributedAt: shifted(new Date("2026-03-01T09:00:00Z")),
    period: "2026-02",
    amountUsdc: 68_000,
    txHash: "0x5eed00000000000000000000000000000000000000000000000000000000f002",
    recipientsCount: 12,
  },
  {
    distributedAt: shifted(new Date("2026-04-02T10:00:00Z")),
    period: "2026-03",
    amountUsdc: 86_400,
    txHash: "0x5eed00000000000000000000000000000000000000000000000000000000f003",
    recipientsCount: 18,
  },
  {
    distributedAt: shifted(new Date("2026-05-01T09:00:00Z")),
    period: "2026-04",
    amountUsdc: 102_800,
    txHash: "0x5eed00000000000000000000000000000000000000000000000000000000f004",
    recipientsCount: 24,
  },
  {
    // May 31 — scheduled, not yet paid (txHash null marks "scheduled" in loader).
    distributedAt: shifted(new Date("2026-05-31T09:00:00Z")),
    period: "2026-05",
    amountUsdc: 96_000,
    txHash: null,
    recipientsCount: 24,
  },
];

function hashFor(seed: string): string {
  let h1 = 0x9e3779b1 ^ seed.length;
  let h2 = 0x85ebca77 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    const c = seed.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x1b873593);
    h2 = Math.imul(h2 ^ c, 0xc2b2ae35);
    h1 = (h1 << 13) | (h1 >>> 19);
    h2 = (h2 << 17) | (h2 >>> 15);
  }
  let hex = "";
  for (let i = 0; i < 4; i++) {
    h1 = Math.imul(h1 ^ (h1 >>> 16), 0x85ebca6b);
    h2 = Math.imul(h2 ^ (h2 >>> 13), 0xc2b2ae35);
    const w1 = (h1 ^ (h1 >>> 16)) >>> 0;
    const w2 = (h2 ^ (h2 >>> 16)) >>> 0;
    hex += w1.toString(16).padStart(8, "0");
    hex += w2.toString(16).padStart(8, "0");
  }
  return "0x" + hex.slice(0, 64);
}

function ipfsUriFor(hash: string): string {
  const body = hash.replace(/^0x/, "").slice(0, 44);
  return `ipfs://Qm${body}`;
}

async function resetTables(): Promise<void> {
  // Opt-in: PROD_BOOTSTRAP=1 skips the reset entirely (assumes an empty DB on a
  // fresh prod database). Lets us run seed.ts against prod for first-time
  // bootstrap without wiping anything.
  if (process.env.PROD_BOOTSTRAP === "1") {
    console.log("[seed] PROD_BOOTSTRAP=1 → skipping resetTables (assumes empty DB).");
    return;
  }

  // Production guard: never wipe a production database from the seed script.
  if (process.env.NODE_ENV === "production") {
    console.error(
      "[seed] ABORT: resetTables() refuses to run with NODE_ENV=production. " +
        "This would deleteMany() across every table. Unset NODE_ENV or run against a dev/test DB.",
    );
    process.exit(1);
  }

  // Order matters: children before parents.
  await prisma.allocation.deleteMany();
  await prisma.vaultSnapshot.deleteMany();
  await prisma.backtestRun.deleteMany();
  await prisma.scenarioRun.deleteMany();
  await prisma.rebalanceEvent.deleteMany();
  await prisma.distribution.deleteMany();
  await prisma.miningMetric.deleteMany();
  await prisma.proof.deleteMany();
}

// ---------------------------------------------------------------------------
// Vault snapshots — preset-anchored (used by memo loader) + daily timeline.
// ---------------------------------------------------------------------------

interface BucketDefinition {
  bucket: "mining" | "btc_tactical" | "usdc_base" | "stable_reserve";
  basePct: number;
  oscillation: number;
  yieldBps: number;
}

// Target allocation centred on "balanced" mode with mild daily oscillation.
const DAILY_BUCKETS: BucketDefinition[] = [
  { bucket: "mining", basePct: 34, oscillation: 2, yieldBps: 620 },
  { bucket: "btc_tactical", basePct: 14, oscillation: 1.5, yieldBps: 0 },
  { bucket: "usdc_base", basePct: 38, oscillation: 1.5, yieldBps: 480 },
  { bucket: "stable_reserve", basePct: 14, oscillation: 1, yieldBps: 450 },
];

async function seedDailyVaultTimeline(): Promise<{
  snapshots: number;
  allocations: number;
}> {
  let snapshots = 0;
  let allocations = 0;

  for (let dayOffset = DAILY_WINDOW_DAYS - 1; dayOffset >= 0; dayOffset -= 1) {
    const takenAt = new Date(SEED_NOW.getTime() - dayOffset * 24 * 60 * 60 * 1000);
    const t = (DAILY_WINDOW_DAYS - 1 - dayOffset) / Math.max(1, DAILY_WINDOW_DAYS - 1);

    // Linear AUM growth 8M -> 12M with a small sinusoidal wobble.
    const aumLinear =
      DAILY_AUM_START + (DAILY_AUM_END - DAILY_AUM_START) * t;
    const aumWobble = 1 + 0.01 * Math.sin(dayOffset * 0.4);
    const aumUsdc = Math.round(aumLinear * aumWobble);

    // APY oscillates between 9.0 and 13.0 with a slight upward drift.
    const apyMid = 10.5 + 1.5 * Math.sin(dayOffset * 0.35);
    const apyLow = round2(apyMid - 0.6);
    const apyHigh = round2(apyMid + 0.6);
    const stressedApy = round2(apyLow * 0.55);

    const riskScore = 38 + Math.round(8 * Math.abs(Math.sin(dayOffset * 0.5)));
    const miningMarginScore =
      62 + Math.round(12 * Math.abs(Math.cos(dayOffset * 0.4)));
    const mode =
      riskScore >= 60
        ? "defensive"
        : miningMarginScore >= 70
          ? "opportunistic"
          : "balanced";

    const snap = await prisma.vaultSnapshot.create({
      data: {
        takenAt,
        aumUsdc,
        currentApyLow: apyLow,
        currentApyHigh: apyHigh,
        stressedApy,
        riskScore,
        miningMarginScore,
        mode,
        source: "daily-seed",
      },
    });
    snapshots++;

    // Build allocation that sums to ~100. We normalise so the rounding error
    // does not show up on the donut chart.
    const rawPcts = DAILY_BUCKETS.map((b) => {
      const wave = Math.sin(dayOffset * 0.6 + DAILY_BUCKETS.indexOf(b));
      return b.basePct + b.oscillation * wave;
    });
    const sum = rawPcts.reduce((acc, v) => acc + v, 0);
    const normPcts = rawPcts.map((v) => (v / sum) * 100);

    for (let i = 0; i < DAILY_BUCKETS.length; i += 1) {
      const def = DAILY_BUCKETS[i];
      const pctRaw = normPcts[i];
      if (def === undefined || pctRaw === undefined) continue;
      const pct = round2(pctRaw);
      await prisma.allocation.create({
        data: {
          snapshotId: snap.id,
          bucket: def.bucket,
          pct,
          valueUsdc: round2(aumUsdc * (pct / 100)),
          yieldContributionBps: def.yieldBps,
        },
      });
      allocations++;
    }
  }

  return { snapshots, allocations };
}

// ---------------------------------------------------------------------------
// Mining metrics — one row per day across the 30-day window.
// ---------------------------------------------------------------------------

async function seedMiningMetrics(): Promise<number> {
  const baseHashprice = MINING_BASE_INPUTS.hashprice_usd_th_day;
  let prevHashprice: number | null = null;
  let count = 0;

  for (let dayOffset = DAILY_WINDOW_DAYS - 1; dayOffset >= 0; dayOffset -= 1) {
    const takenAt = new Date(SEED_NOW.getTime() - dayOffset * 24 * 60 * 60 * 1000);
    const t = (DAILY_WINDOW_DAYS - 1 - dayOffset) / Math.max(1, DAILY_WINDOW_DAYS - 1);

    // Hashprice oscillates in [0.05, 0.07] with a mild downward bias toward the
    // end of the window (matches the "Hashprice Trend -3.4%" line on the UI).
    const hashprice = round6(
      0.06 + 0.01 * Math.sin(dayOffset * 0.45) - 0.005 * t,
    );

    // Difficulty rises ~1.5% across the window.
    const difficulty = 110e12 * (1 + 0.015 * t);

    // BTC price drifts 90k -> 100k.
    const btcPrice = Math.round(90_000 + 10_000 * t + 1_500 * Math.sin(dayOffset * 0.5));

    const energyCost = MINING_BASE_INPUTS.energy_cost_kwh;
    const uptimePct = round2(97.5 + 1.4 * Math.abs(Math.cos(dayOffset * 0.4)));

    const monthlyInputs: ScenarioInputs = {
      ...MINING_BASE_INPUTS,
      hashprice_usd_th_day: hashprice,
    };
    const revenue = computeMiningRevenue(monthlyInputs);

    const hashpriceTrendPct =
      prevHashprice === null || prevHashprice === 0
        ? 0
        : round2(((hashprice - prevHashprice) / prevHashprice) * 100);

    const operationalConfidence = 80 + Math.round(8 * Math.abs(Math.sin(dayOffset * 0.6)));

    await prisma.miningMetric.create({
      data: {
        takenAt,
        hashprice,
        difficulty,
        btcPrice,
        energyCost,
        uptimePct,
        deployedHashrate: 2500 + Math.round(120 * Math.sin(dayOffset * 0.3)),
        miningMarginScore: Math.round(revenue.margin_score),
        hashpriceTrendPct,
        operationalConfidence,
      },
    });

    prevHashprice = hashprice;
    count++;
  }
  return count;
}

async function seedRebalanceEvents(): Promise<number> {
  let count = 0;
  for (const ev of REBALANCE_FIXTURES) {
    await prisma.rebalanceEvent.create({
      data: {
        executedAt: ev.executedAt,
        ruleId: ev.ruleId,
        triggerText: ev.triggerText,
        actionText: ev.actionText,
        impactText: ev.impactText,
        fromAllocation: JSON.stringify(ev.fromAllocation),
        toAllocation: JSON.stringify(ev.toAllocation),
        txHash: null,
        approvedBy: APPROVED_BY,
      },
    });
    count++;
  }
  return count;
}

async function seedDistributions(): Promise<number> {
  let count = 0;
  for (const d of DISTRIBUTION_FIXTURES) {
    await prisma.distribution.create({
      data: {
        distributedAt: d.distributedAt,
        amountUsdc: d.amountUsdc,
        txHash: d.txHash,
        recipientsCount: d.recipientsCount,
        period: d.period,
      },
    });
    count++;
  }
  return count;
}

async function seedProofs(): Promise<number> {
  let count = 0;
  for (const p of PROOF_FIXTURES) {
    if (p.proofType === "mining_attestation" && p.period) {
      // Real, end-to-end-verifiable signature (digest == on-chain evidenceHash).
      const signed = await signMockAttestation(p.period, {}, p.postedAt);
      await prisma.proof.create({
        data: {
          proofType: p.proofType,
          period: p.period,
          hash: signed.digest,
          uri: signed.payload.evidenceCid,
          postedAt: p.postedAt,
          postedBy: `Attestor ${MOCK_ATTESTOR_ADDRESS.slice(0, 6)}…${MOCK_ATTESTOR_ADDRESS.slice(-4)} · mock signer`,
          txHash: null,
          signer: signed.payload.attestor,
          signature: signed.signature,
          payloadJson: JSON.stringify(signed.payload),
        },
      });
    } else {
      const hash = hashFor(p.seed);
      await prisma.proof.create({
        data: {
          proofType: p.proofType,
          period: p.period,
          hash,
          uri: ipfsUriFor(hash),
          postedAt: p.postedAt,
          postedBy: "ops@hearst.connect",
          txHash: null,
        },
      });
    }
    count++;
  }
  return count;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round6(n: number): number {
  return Math.round(n * 1_000_000) / 1_000_000;
}

// ---------------------------------------------------------------------------
// Vault deployments — 3 first-class vaults (ADR-006). Idempotent upserts so
// re-seeding never duplicates rows nor mutates a manually-edited deployment in
// a destructive way. Each vault has its OWN id, ticker, APY range, allocation
// targets, assumptions — no silent reuse across vaults (#9).
//
// Status policy (paper phase): the flagship Hearst Yield Vault is "live"; the
// two new vaults stay in "review" until they have their own attested numbers.
// ---------------------------------------------------------------------------

interface VaultDeploymentFixture {
  id: string;
  status: "live" | "review";
  strategy: "mining_yield" | "btc_tactical" | "stable_reserve";
  definition: VaultDefinition;
}

const VAULT_DEPLOYMENT_FIXTURES: VaultDeploymentFixture[] = [
  {
    id: "hearst-yield-vault",
    status: "live",
    strategy: "mining_yield",
    definition: VAULT_YIELD,
  },
  {
    id: "hearst-defensive-vault",
    status: "review",
    strategy: "stable_reserve",
    definition: VAULT_DEFENSIVE,
  },
  {
    id: "hearst-btc-plus-vault",
    status: "review",
    strategy: "btc_tactical",
    definition: VAULT_BTC_PLUS,
  },
];

async function seedVaultDeployments(): Promise<number> {
  // Resolve the Yield Vault on-chain address from the committed deployment
  // registry so the row is never filtered out by isPlaceholderVault() after a
  // clean seed. The helper reads config/deployments.base-sepolia.json — no env
  // required. Other vaults stay without contractAddress (paper-phase, review
  // status) and are intentionally hidden from the investor surface.
  const yieldVaultDeployment = getDeployment("vault");
  const YIELD_VAULT_CONTRACT_ADDRESS = yieldVaultDeployment.address;
  const YIELD_VAULT_NETWORK = String(yieldVaultDeployment.chainId); // "84532"

  let count = 0;
  for (const f of VAULT_DEPLOYMENT_FIXTURES) {
    const d = f.definition;
    const a = d.allocationTargets;
    const classA = d.shareClasses[0];

    // Only the Yield vault has a real on-chain deployment. The defensive and
    // BTC-plus vaults are paper-phase (review status) — leave contractAddress
    // unset so isPlaceholderVault() correctly hides them from the investor UI.
    const onChainFields =
      f.id === "hearst-yield-vault"
        ? {
            contractAddress: YIELD_VAULT_CONTRACT_ADDRESS,
            network: YIELD_VAULT_NETWORK,
          }
        : {};

    const data = {
      ticker: `${d.ticker}-A`,
      name: d.label,
      description: d.description,
      strategy: f.strategy,
      colorTag: "accent",
      status: f.status,
      minTicketUsdc: classA?.minTicketUsdc ?? 250_000,
      capacityUsdc: 100_000_000,
      mgmtFeeBps: classA?.mgmtFeeBps ?? SHARE_CLASS_A.mgmtFeeBps,
      perfFeeBps: classA?.perfFeeBps ?? SHARE_CLASS_A.perfFeeBps,
      hurdleBps: classA?.hurdleBps ?? 0,
      softLockupDays: classA?.softLockupDays ?? 60,
      targetApyLowBps: Math.round(d.apyTarget.low * 100),
      targetApyHighBps: Math.round(d.apyTarget.high * 100),
      spvJurisdiction: "cayman",
      shareClass: "A",
      regExemption: "regS",
      // Disclaimers join the vault's own assumptions verbatim (no silent reuse
      // across vaults). ADR-006 #9: each vault carries its own assumptions.
      disclaimers: d.assumptions.join(" "),
      targetMiningBps: a.mining * 100,
      targetBtcTacticalBps: a.btc_tactical * 100,
      targetUsdcBaseBps: a.usdc_base * 100,
      targetStableReserveBps: a.stable_reserve * 100,
      requiredSigners: 2,
      signersWhitelist: JSON.stringify(["multisig:0xAAA", "multisig:0xBBB"]),
      createdBy: "seed-user",
      ...onChainFields,
    };
    await prisma.vaultDeployment.upsert({
      where: { id: f.id },
      update: data,
      create: { id: f.id, ...data },
    });
    count++;
  }
  return count;
}

// ---------------------------------------------------------------------------
// Defensive Vault — testnet-only deployment row (Base Sepolia, chain 84532).
//
// This row tracks the Defensive Vault stub on testnet before a mainnet audit
// clears the way for a real deployment. The ticker "HDV-T" distinguishes it
// from the paper-phase "HDV-A" row above. Idempotent upsert on id="defensive".
//
// Field mapping from task spec → VaultDeployment schema:
//   slug          → id (primary key, human-readable for tooling)
//   chainId 84532 → network "84532" (Base Sepolia, stored as string)
//   address       → contractAddress (placeholder, never deployed)
//   status TESTNET→ status "testnet"
//   apyMin 0.06   → targetApyLowBps 600 (6 %)
//   apyMax 0.09   → targetApyHighBps 900 (9 %)
//   lockupDays 30 → softLockupDays 30
//   minTicket     → minTicketUsdc 100_000
//   requiredSigners 3 / totalSigners 5 → requiredSigners + 5-item signersWhitelist
//
// Allocation bps (from VAULT_DEFENSIVE targets): mining 20 % → 2000 bps,
// btc_tactical 10 % → 1000 bps, usdc_base 35 % → 3500 bps,
// stable_reserve 35 % → 3500 bps — sum = 10000 ✓
// ---------------------------------------------------------------------------

const DEFENSIVE_TESTNET_SIGNERS = JSON.stringify([
  "0x0000000000000000000000000000000000000011",
  "0x0000000000000000000000000000000000000012",
  "0x0000000000000000000000000000000000000013",
  "0x0000000000000000000000000000000000000014",
  "0x0000000000000000000000000000000000000015",
]);

async function seedDefensiveTestnetDeployment(): Promise<void> {
  const data = {
    ticker: "HDV-T",
    name: "Hearst Defensive Vault",
    description: VAULT_DEFENSIVE.description,
    strategy: "stable_reserve" as const,
    colorTag: "accent",
    status: "testnet",
    network: "84532",
    contractAddress: "0x0000000000000000000000000000000000000002",
    minTicketUsdc: 100_000,
    capacityUsdc: 50_000_000,
    mgmtFeeBps: 200,
    perfFeeBps: 1_000,
    hurdleBps: 0,
    softLockupDays: 30,
    targetApyLowBps: 600,
    targetApyHighBps: 900,
    spvJurisdiction: "cayman",
    shareClass: "A",
    regExemption: "regS",
    disclaimers: VAULT_DEFENSIVE.assumptions.join(" "),
    targetMiningBps: 2_000,
    targetBtcTacticalBps: 1_000,
    targetUsdcBaseBps: 3_500,
    targetStableReserveBps: 3_500,
    requiredSigners: 3,
    signersWhitelist: DEFENSIVE_TESTNET_SIGNERS,
    createdBy: "seed-user",
  };
  await prisma.vaultDeployment.upsert({
    where: { id: "defensive" },
    update: data,
    create: { id: "defensive", ...data },
  });
}

// ---------------------------------------------------------------------------
// BTC-Plus Vault — testnet-only deployment row (Base Sepolia, chain 84532).
// F3 stream: port into VaultDeployment (same pattern as F2 Defensive).
// VaultOnchainDeployment model was dropped per Phase-6 merge strategy.
// ---------------------------------------------------------------------------

const BTC_PLUS_TESTNET_SIGNERS = JSON.stringify([
  "0x0000000000000000000000000000000000000021",
  "0x0000000000000000000000000000000000000022",
  "0x0000000000000000000000000000000000000023",
  "0x0000000000000000000000000000000000000024",
  "0x0000000000000000000000000000000000000025",
]);

async function seedBtcPlusTestnetDeployment(): Promise<void> {
  const data = {
    ticker: "HBV-T",
    name: "Hearst BTC Plus Vault",
    description: VAULT_BTC_PLUS.description,
    strategy: "btc_tactical" as const,
    colorTag: "accent",
    status: "testnet",
    network: "84532",
    contractAddress: "0x0000000000000000000000000000000000000003",
    minTicketUsdc: 500_000,
    capacityUsdc: 100_000_000,
    mgmtFeeBps: 150,
    perfFeeBps: 1_500,
    hurdleBps: 600, // 6% hurdle
    softLockupDays: 90,
    targetApyLowBps: 1_200,
    targetApyHighBps: 1_800,
    spvJurisdiction: "cayman",
    shareClass: "A",
    regExemption: "regS",
    disclaimers: VAULT_BTC_PLUS.assumptions.join(" "),
    targetMiningBps: 3_000,
    targetBtcTacticalBps: 4_500,
    targetUsdcBaseBps: 1_500,
    targetStableReserveBps: 1_000,
    requiredSigners: 3,
    signersWhitelist: BTC_PLUS_TESTNET_SIGNERS,
    createdBy: "seed-user",
  };
  await prisma.vaultDeployment.upsert({
    where: { id: "btc-plus" },
    update: data,
    create: { id: "btc-plus", ...data },
  });
}

// ---------------------------------------------------------------------------
// Share classes — idempotent upsert of class A + B for every VaultDeployment.
// E1: class A (minTicket=250k, 60d, mgmt=100bps, perf=1000bps)
// E2: class B (minTicket=1M, 90d, mgmt=75bps, perf=800bps)
// Uses schema field names from E1 (minTicket, not minTicketUsdc).
// ---------------------------------------------------------------------------

async function seedShareClasses(): Promise<number> {
  const vaults = await prisma.vaultDeployment.findMany({
    select: { id: true },
  });
  let count = 0;
  const classSpecs = [
    { code: "A", minTicket: 250_000, lockupDays: 60, mgmtFeeBps: 100, perfFeeBps: 1000 },
    { code: "B", minTicket: 1_000_000, lockupDays: 90, mgmtFeeBps: 75, perfFeeBps: 800 },
  ];
  for (const vault of vaults) {
    for (const cls of classSpecs) {
      await prisma.shareClass.upsert({
        where: { vaultId_code: { vaultId: vault.id, code: cls.code } },
        update: {
          minTicket: cls.minTicket,
          lockupDays: cls.lockupDays,
          mgmtFeeBps: cls.mgmtFeeBps,
          perfFeeBps: cls.perfFeeBps,
          active: true,
        },
        create: {
          vaultId: vault.id,
          code: cls.code,
          minTicket: cls.minTicket,
          lockupDays: cls.lockupDays,
          mgmtFeeBps: cls.mgmtFeeBps,
          perfFeeBps: cls.perfFeeBps,
          active: true,
        },
      });
      count++;
    }
  }
  return count;
}

// ---------------------------------------------------------------------------
// Admin users — idempotent. Reads ADMIN_EMAILS (CSV) + ADMIN_INITIAL_PASSWORD.
// Upserts a role="admin" User per email. Does NOT create an Investor for the
// admin. No-op when either env var is unset. Intentionally OUTSIDE resetTables()
// so re-seeding fixtures never wipes admin credentials.
// ---------------------------------------------------------------------------
const ARGON2_OPTIONS = {
  algorithm: 2, // Argon2id
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

async function seedAdminUsers(): Promise<number> {
  const raw = process.env.ADMIN_EMAILS ?? "";
  const password = process.env.ADMIN_INITIAL_PASSWORD ?? "";
  const emails = raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (emails.length === 0 || password.length === 0) {
    console.log(
      "  AdminUser:       0 (set ADMIN_EMAILS + ADMIN_INITIAL_PASSWORD to seed admins)",
    );
    return 0;
  }

  const passwordHash = await hash(password, ARGON2_OPTIONS);
  let count = 0;
  for (const email of emails) {
    await prisma.user.upsert({
      where: { email },
      // Idempotent: keep existing accounts as admins, refresh the password to
      // the configured initial password (operator-controlled bootstrap).
      update: { role: "admin", passwordHash },
      create: { email, role: "admin", passwordHash },
    });
    count++;
  }
  return count;
}

async function main(): Promise<void> {
  await resetTables();
  // VaultDeployment is seeded BEFORE resetTables would otherwise wipe positions
  // referencing it — but the row is not part of resetTables (deployments live
  // in admin scope). Idempotent upsert keeps it safe to re-run N times.
  const vaultDeployments = await seedVaultDeployments();
  // Testnet-only Defensive Vault stub (Base Sepolia, chain 84532).
  await seedDefensiveTestnetDeployment();
  // Testnet-only BTC-Plus Vault stub (Base Sepolia, chain 84532) — F3 stream.
  await seedBtcPlusTestnetDeployment();
  // ShareClasses (A + B) depend on VaultDeployment rows existing first.
  const shareClasses = await seedShareClasses();
  const admins = await seedAdminUsers();
  const dailyVault = await seedDailyVaultTimeline();
  const miningMetrics = await seedMiningMetrics();
  const rebalances = await seedRebalanceEvents();
  const distributions = await seedDistributions();
  const proofs = await seedProofs();

  console.log("Hearst Connect seed complete:");
  console.log(`  VaultDeployment: ${vaultDeployments + 2} (3 first-class vaults + defensive + btc-plus testnet — ADR-006)`);
  console.log(`  ShareClass:      ${shareClasses} (A + B per vault)`);
  console.log(`  AdminUser:       ${admins}`);
  console.log(`  VaultSnapshot:   ${dailyVault.snapshots} (daily)`);
  console.log(`  Allocation:      ${dailyVault.allocations}`);
  console.log(`  MiningMetric:    ${miningMetrics}`);
  console.log(`  RebalanceEvent:  ${rebalances}`);
  console.log(`  Distribution:    ${distributions}`);
  console.log(`  Proof:           ${proofs}`);
}

main()
  .catch((err: unknown) => {
    console.error("Seed failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
