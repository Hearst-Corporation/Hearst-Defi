// Demo Provider builders (Lot 2).
//
// Pure, deterministic builders that synthesize the read-only demo dataset shown
// to the recognized demo identity (see provider.ts / isDemoInvestor). They are
// NOT loaders: no Prisma, no fetch, no I/O, no auth. Each page decides whether
// to call them based on `isDemoInvestor(investor)` (guard-gated → never prod).
//
// Coherence contract — ONE demo vault is referenced everywhere:
//   id     = DEMO_YIELD_VAULT_ID ("hearst-yield-vault")
//   ticker = "HYV-A"
//   name   = "Hearst Yield Vault"
//   APY    = 9.4 – 12.8 % (identical across vault, portfolio position, proofs)
// status MUST be "live" so /vaults/[id] is navigable and the deposit CTA shows.
//
// Honesty rules carried into the demo data:
//   - NO real settled tx hash is presented (we use the 0xdemo… sentinel or null).
//   - NO production contract address is claimed as live anywhere here.
//   - The portfolio uses PortfolioData.source = "fallback" (the union is NOT
//     extended with "demo"); the demo *signal* is carried by the page banner.

import {
  DEMO_INVESTOR_EMAIL,
  DEMO_POSITION_ID,
  DEMO_YIELD_VAULT_ID,
} from "@/lib/dev/investor-demo";
import { aggregateLpPnl, computeLpPnl, daysHeldSince } from "@/lib/engine/lp-pnl";
import type {
  PortfolioData,
  PositionDetail,
  PositionDetailTransaction,
} from "@/lib/data/portfolio";
import type { VaultProduct } from "@/lib/data/vaults";
import type { ProofItem } from "@/lib/proof-center-types";

import { DEMO_SENTINEL_HASH } from "./markers";

export { DEMO_INVESTOR_EMAIL, DEMO_YIELD_VAULT_ID };

// ---------------------------------------------------------------------------
// Shared demo constants — single source of truth for the whole dataset.
// ---------------------------------------------------------------------------

const DEMO_VAULT_TICKER = "HYV-A" as const;
const DEMO_VAULT_NAME = "Hearst Yield Vault" as const;

/** APY range reused EVERYWHERE (vault card, term sheet, position). */
const DEMO_APY_LOW = 9.4 as const;
const DEMO_APY_HIGH = 12.8 as const;

/** Period stamped on the demo proofs — must match the position's vault. */
const DEMO_PROOF_PERIOD = "2026-05" as const;

// DEMO_SENTINEL_HASH (the 0xde…0 non-real digest used on demo proofs) now lives
// in ./markers as the single source of truth and is imported above.

/** Stable "now" anchor is supplied by the caller-free helpers via `new Date()`
 *  only where a relative date is needed (position subscribedAt). The builders
 *  stay pure w.r.t. their *inputs*; the single `new Date()` use is confined to
 *  deriving a plausible subscribedAt and is documented as non-load-bearing. */
function demoSubscribedAt(now: Date): Date {
  // ~120 days ago — past the 60-day soft lock-up so the position reads "active
  // and unlocked" in the demo, with a meaningful holding period for P&L.
  return new Date(now.getTime() - 120 * 86_400_000);
}

function nextEndOfMonthUtc(now: Date): Date {
  const eom = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 0),
  );
  if (now.getUTCDate() === eom.getUTCDate()) {
    return new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 2, 0, 23, 59, 59, 0),
    );
  }
  return eom;
}

// ---------------------------------------------------------------------------
// Vault
// ---------------------------------------------------------------------------

/** The single demo vault, matching the VaultProduct loader shape exactly. */
function demoVault(): VaultProduct {
  return {
    id: DEMO_YIELD_VAULT_ID,
    ticker: DEMO_VAULT_TICKER,
    name: DEMO_VAULT_NAME,
    description:
      "Mining-backed structured yield with monthly USDC distributions. Demo sandbox data — not a live subscription.",
    strategy: "mining_yield",
    status: "live", // navigable + deposit CTA visible in the demo flow
    apyLow: DEMO_APY_LOW,
    apyHigh: DEMO_APY_HIGH,
    minTicketUsdc: 250_000,
    softLockupDays: 60,
    capacityUsdc: 50_000_000,
    currentAumUsdc: 25_000_000,
    fees: { mgmtBps: 200, perfBps: 1500, hurdleBps: 600 },
    riskLevel: "low-moderate",
    spvJurisdiction: "Cayman Islands",
    shareClass: "A",
    regExemption: "Reg S / Reg D 506(c)",
    disclaimers:
      "Demo data. Not live. No real subscription. APY shown as a range and is not guaranteed.",
    targetMiningBps: 6000,
    targetBtcTacticalBps: 1500,
    targetUsdcBaseBps: 1500,
    targetStableReserveBps: 1000,
  };
}

/** Returns the demo vault list (a single vault). */
export function buildDemoVaults(): VaultProduct[] {
  return [demoVault()];
}

/**
 * Returns the demo vault when `id` matches the demo vault id or ticker,
 * otherwise null (so the page keeps its notFound() behavior). Matching is
 * case-insensitive on the ticker, mirroring getVault().
 */
export function buildDemoVaultDetail(id: string): VaultProduct | null {
  const v = demoVault();
  if (id === v.id) return v;
  if (id.toUpperCase() === v.ticker.toUpperCase()) return v;
  return null;
}

// ---------------------------------------------------------------------------
// Portfolio
// ---------------------------------------------------------------------------

/**
 * A coherent demo portfolio: one active position in the demo vault, with the
 * same APY range and a holding period consistent with `demoSubscribedAt`.
 * `source` stays "fallback" (union unchanged); the demo signal is the banner.
 */
/**
 * The single position's figures + activity, shared by buildDemoPortfolio (list
 * view) and buildDemoPositionDetail (detail view) so the two never disagree.
 * Pure: takes `now`, returns plain numbers/dates. No tx hash is ever real (null).
 */
function demoPositionFigures(now: Date) {
  const subscribedAt = demoSubscribedAt(now);
  const principalUsdc = 500_000;
  const accruedYieldUsdc = 42_000;
  const distributedUsdc = 18_000;
  const valueUsdc = principalUsdc + accruedYieldUsdc;
  const monthMs = 30 * 86_400_000;

  // Opening deposit + three monthly distributions. No settled tx hash (null).
  const activity = [
    { id: "demo-tx-deposit", type: "deposit" as const, amountUsdc: principalUsdc, occurredAt: subscribedAt },
    { id: "demo-tx-distribution-1", type: "distribution" as const, amountUsdc: 6_000, occurredAt: new Date(subscribedAt.getTime() + monthMs) },
    { id: "demo-tx-distribution-2", type: "distribution" as const, amountUsdc: 6_000, occurredAt: new Date(subscribedAt.getTime() + 2 * monthMs) },
    { id: "demo-tx-distribution-3", type: "distribution" as const, amountUsdc: 6_000, occurredAt: new Date(subscribedAt.getTime() + 3 * monthMs) },
  ];

  return { subscribedAt, principalUsdc, accruedYieldUsdc, distributedUsdc, valueUsdc, activity };
}

export function buildDemoPortfolio(): PortfolioData {
  const now = new Date();
  const figures = demoPositionFigures(now);
  const { subscribedAt, principalUsdc, accruedYieldUsdc, distributedUsdc, valueUsdc } = figures;

  const position = {
    id: DEMO_POSITION_ID,
    vaultName: DEMO_VAULT_NAME,
    principalUsdc,
    accruedYieldUsdc,
    distributedUsdc,
    valueUsdc,
    status: "active" as const,
    apyLow: DEMO_APY_LOW,
    apyHigh: DEMO_APY_HIGH,
    subscribedAt,
  };

  // Coherent recent activity, shared with the detail view via demoPositionFigures.
  // No settled tx hash claimed (null) — the demo never presents an on-chain settlement.
  const recentTransactions = figures.activity.map((t) => ({
    ...t,
    txHash: null,
    positionVaultName: DEMO_VAULT_NAME,
  }));

  const pnl = aggregateLpPnl([
    {
      contributedUsdc: principalUsdc,
      distributedUsdc,
      accruedYieldUsdc,
      daysHeld: daysHeldSince(subscribedAt, now),
    },
  ]);

  // totalYieldYtdUsdc: distributed (paid) + accrued (not yet paid), mirroring
  // the live loader's "distributions + accrued" composition.
  const totalYieldYtdUsdc = distributedUsdc + accruedYieldUsdc;

  return {
    positions: [position],
    totalValueUsdc: valueUsdc,
    totalYieldYtdUsdc,
    nextDistributionAt: nextEndOfMonthUtc(now),
    recentTransactions,
    pnl,
    source: "fallback", // union NOT extended; banner carries the demo signal
    updatedAt: now,
  };
}

/**
 * The single demo position rendered at /portfolio/[positionId]. Built from the
 * SAME figures as buildDemoPortfolio so the list and the detail never disagree.
 * `source: "fallback"` (never "live"), `txHashOpen: null` (no on-chain claim);
 * the page banner carries the demo signal. Returned only for DEMO_POSITION_ID.
 */
export function buildDemoPositionDetail(): PositionDetail {
  const now = new Date();
  const { subscribedAt, principalUsdc, accruedYieldUsdc, distributedUsdc, activity } =
    demoPositionFigures(now);

  // Newest-first, mirroring the live loader's orderBy occurredAt desc.
  const transactions: PositionDetailTransaction[] = activity
    .map((t) => ({ id: t.id, type: t.type, amountUsdc: t.amountUsdc, occurredAt: t.occurredAt, txHash: null }))
    .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());

  const pnl = computeLpPnl({
    contributedUsdc: principalUsdc,
    distributedUsdc,
    accruedYieldUsdc,
    daysHeld: daysHeldSince(subscribedAt, now),
  });

  return {
    id: DEMO_POSITION_ID,
    vaultName: DEMO_VAULT_NAME,
    vaultTicker: DEMO_VAULT_TICKER,
    status: "active",
    principalUsdc,
    accruedYieldUsdc,
    distributedUsdc,
    realizedApyLow: DEMO_APY_LOW,
    realizedApyHigh: DEMO_APY_HIGH,
    subscribedAt,
    maturedAt: null,
    txHashOpen: null,
    transactions,
    pnl,
    source: "fallback",
  };
}

// ---------------------------------------------------------------------------
// Proofs
// ---------------------------------------------------------------------------

/**
 * Demo proof grid items (the off-chain "paper" rows). All reference the demo
 * vault's period; none claim a settled on-chain tx (txHash = null). Hashes use
 * the 0xde…0 sentinel so they read as demo, never as real digests.
 */
export function buildDemoProofs(): ProofItem[] {
  const postedAt = new Date().toISOString();
  return [
    {
      id: "demo-proof-mining",
      proofType: "mining_attestation",
      period: DEMO_PROOF_PERIOD,
      title: `Mining attestation · ${DEMO_PROOF_PERIOD}`,
      hash: DEMO_SENTINEL_HASH,
      uri: "https://demo.invalid/proofs/mining-2026-05",
      postedAt,
      postedBy: "Demo Sandbox",
      txHash: null,
      signer: null,
      attestationVerified: null,
    },
    {
      id: "demo-proof-custody",
      proofType: "custody",
      period: DEMO_PROOF_PERIOD,
      title: `Custody proof-of-reserves snapshot · ${DEMO_PROOF_PERIOD}`,
      hash: DEMO_SENTINEL_HASH,
      uri: "https://demo.invalid/proofs/custody-2026-05",
      postedAt,
      postedBy: "Demo Sandbox",
      txHash: null,
      signer: null,
      attestationVerified: null,
    },
    {
      id: "demo-proof-audit",
      proofType: "audit",
      period: null,
      title: "Audit report",
      hash: DEMO_SENTINEL_HASH,
      uri: "https://demo.invalid/proofs/audit",
      postedAt,
      postedBy: "Demo Sandbox",
      txHash: null,
      signer: null,
      attestationVerified: null,
    },
    {
      id: "demo-proof-methodology",
      proofType: "methodology",
      period: null,
      title: "Methodology document",
      hash: DEMO_SENTINEL_HASH,
      uri: "https://demo.invalid/proofs/methodology-v1",
      postedAt,
      postedBy: "Demo Sandbox",
      txHash: null,
      signer: null,
      attestationVerified: null,
    },
  ];
}
