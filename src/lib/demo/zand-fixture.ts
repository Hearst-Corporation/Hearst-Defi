// NOTE: intentionally NOT `import "server-only"` — this module takes a
// PrismaClient as a parameter (never imports the app db client) and is shared
// between Server Actions (demoSeedZandFixture) AND the standalone CLI seed
// script (prisma/seed-zand-demo.ts). The `server-only` guard would crash the
// CLI. The real server boundary lives on the callers.
import type { PrismaClient } from "@prisma/client";

/**
 * Shared fixture-position builder for the Zand institutional demo account
 * (zand.demo@hearstcorporation.io) — SERIES 1 of the Hearst Mining Note
 * (methodology v3.0, ADR-019).
 *
 * SERIES 1 narrative (this is a BTC-ACCUMULATION instrument, NOT a yield vault):
 *
 *   Capital deposited ($2M) → allocated across 3 on-chain pockets
 *   B1 Mining Power / B2 BTC Pouch / B3 Reserve USDC (40 / 27 / 33) →
 *   real Bitcoin mining output → reserve operations →
 *   BTC ACCUMULATED over a 24-month term →
 *   BTC DELIVERED at maturity → proofs available.
 *
 * There is **NO periodic cash distribution and NO fixed APY**. The retired
 * "yield vault / 12 monthly USDC distributions / ~9-12% APY" framing has been
 * removed entirely: this fixture creates ZERO `distribution` ledger rows and
 * reports ZERO distributed USDC. The value the position accrues is the
 * ESTIMATED USD value of BTC accumulated-to-date, carried on
 * `Position.accruedYieldUsdc` (capitalized, never distributed) with Manual /
 * Estimated provenance — it is not realized cash and is not a guaranteed return.
 *
 * Schema note: no Prisma schema change is required or permitted here. The
 * accumulation story maps onto the EXISTING models — `Position`
 * (principal + accrued, `distributedUsdc` pinned to 0) and a single opening
 * `deposit` `InvestorTransaction`. No new transaction type / enum / migration.
 *
 * The exact same position + opening deposit can be (re)created from TWO callers:
 *
 *   1. `prisma/seed-zand-demo.ts` — the one-shot CLI seeder (keeps its own
 *      prod-write guard, main(), and console narration; only the DB logic
 *      lives here).
 *   2. `demoSeedZandFixture` (portfolio demo-actions) — the in-app
 *      "Seed $2M fixture" lever on the demo timeline control, so the SERIES 1
 *      story is recoverable from the browser after a Reset.
 *
 * NOTE — Reset does NOT re-seed: "Reset (0)" wipes to a genuinely empty
 * portfolio for every account, Zand included (an automatic re-seed existed
 * briefly and was deliberately removed). Re-creating the fixture is always an
 * explicit action (CLI or the in-app seed lever).
 *
 * IDEMPOTENT: keyed off `ZAND_SEED_DEPOSIT_TXHASH`, a unique column value —
 * re-running never duplicates data (see the doc comment in
 * prisma/seed-zand-demo.ts for why this txHash, not vaultKey, is the fixture
 * marker).
 */

/**
 * Auth email of the Zand institutional demo account. Used to gate the in-app
 * "Seed $2M fixture" lever (matched case-insensitively on the SESSION email,
 * like isDemoAccount) — never a hard-coded investor id, whose cuid differs
 * between dev and prod.
 */
export const ZAND_FIXTURE_EMAIL = "zand.demo@hearstcorporation.io";

/** Same VaultDeployment id used by scripts/demo/timeline.ts and scripts/seed-dev-position.ts. */
const VAULT_DEPLOYMENT_ID = "hearst-yield-vault";

/**
 * vaultKey of the fixture position. The base is the schema's own single-vault
 * default (`hearst_yield_vault`, underscores — see prisma/schema.prisma
 * Position.vaultKey default), suffixed `:class-A`. What actually matters is
 * the SUFFIX: the portfolio loader's share-class matcher
 * (src/lib/data/portfolio.ts) reads the `/:class-([AB])$/i` suffix to derive
 * the share-class terms (60-day soft lock-up, etc.); a non-matching key would
 * make the lock-up meter fall back to "stale". Idempotency is tracked
 * separately, via ZAND_SEED_DEPOSIT_TXHASH below (a unique column), never via
 * this vaultKey.
 */
export const ZAND_FIXTURE_VAULT_KEY = "hearst_yield_vault:class-A";

/**
 * Deterministic, unique marker for the seed's deposit InvestorTransaction.
 * InvestorTransaction.txHash is `@unique` (prisma/schema.prisma) with NULLs
 * exempt, so a fixed recognizable value here both (a) never collides with a
 * real on-chain deposit hash and (b) doubles as the idempotency check: a
 * (re-)seed looks up this exact txHash instead of matching on vaultKey (which
 * now equals the real subscribe-flow pattern and can no longer serve as a
 * fixture marker on its own).
 */
export const ZAND_SEED_DEPOSIT_TXHASH =
  "0xZANDDEMOSEED0000000000000000000000000000000000000000000000000000";

/** Institutional demo ticket size for Zand (SERIES 1 subscription). */
export const ZAND_FIXTURE_PRINCIPAL_USDC = 2_000_000;

/** Fixed, deterministic anchor — 2025-01-01 UTC. No Date.now(), no PRNG. */
const SUBSCRIBED_AT = new Date(Date.UTC(2025, 0, 1, 0, 0, 0, 0));

/**
 * SERIES 1 pocket split — B1 Mining Power / B2 BTC Pouch / B3 Reserve USDC.
 * The 40 / 27 / 33 on-chain allocation of the deposited capital (ADR-019,
 * v3.0). Deterministic; sums to 100. Exposed so the demo surfaces + the
 * validator can assert the split matches the note's structure — no APY, no
 * legacy 4-bucket (mining/tactical/usdc-base/stable-reserve) allocation.
 */
export const ZAND_FIXTURE_POCKET_SPLIT = {
  /** B1 Mining Power. */
  miningPowerPct: 40,
  /** B2 BTC Pouch. */
  btcPouchPct: 27,
  /** B3 Reserve USDC. */
  reserveUsdcPct: 33,
} as const;

/**
 * Estimated USD value of BTC ACCUMULATED to date on the SERIES 1 note, carried
 * on `Position.accruedYieldUsdc`. This is capitalized (delivered as BTC at
 * maturity), NEVER distributed as cash — `distributedUsdc` stays 0. It is an
 * ESTIMATED / Manual figure, not realized cash and not a guaranteed return.
 * Deterministic, fixed value — no PRNG, no Date.now(). ~5.4% of a $2M ticket
 * accumulated part-way through the 24-month term, disclosed as accumulated BTC
 * value, not an APY.
 */
export const ZAND_FIXTURE_ACCUMULATED_BTC_VALUE_USDC = 108_400;

/**
 * Distributed cash on a SERIES 1 note is ALWAYS zero: BTC is accumulated and
 * delivered at maturity, never paid out periodically. Kept as a named constant
 * so callers + the validator read the intent explicitly.
 */
export const ZAND_FIXTURE_DISTRIBUTED_USDC = 0;

export interface ZandFixtureSeedResult {
  /** True when a new position was created; false when the fixture already existed (idempotent no-op). */
  created: boolean;
  positionId: string;
  /** Estimated USD value of BTC accumulated-to-date (capitalized, never distributed). */
  accumulatedBtcValueUsdc: number;
  /** Always 0 on a SERIES 1 mining note — kept for callers that logged a distributed figure. */
  distributedUsdc: number;
}

/**
 * (Re-)creates the Zand SERIES 1 fixture position — 1 Position ($2M principal,
 * accruing BTC value, 0 distributed) and exactly 1 opening `deposit`
 * InvestorTransaction — for `investorId`, inside a single `$transaction`.
 *
 * ZERO distribution rows are created (BTC accumulation, not cash payout).
 *
 * Idempotent: if a deposit row already carries `ZAND_SEED_DEPOSIT_TXHASH`,
 * this returns immediately with `created: false` and touches nothing.
 *
 * `investorId` is accepted as a parameter (not resolved internally by email)
 * so this can run against any PrismaClient — the CLI script resolves it once
 * via a User/Investor lookup by email; `resetInvestorTimeline` already has
 * the investorId in hand and only needs to know IF it should call this.
 */
export async function seedZandFixturePosition(
  prisma: PrismaClient,
  investorId: string,
): Promise<ZandFixtureSeedResult> {
  // ── Idempotency check ────────────────────────────────────────────────
  // Keyed off the deposit tx's unique txHash marker, NOT vaultKey — see
  // ZAND_FIXTURE_VAULT_KEY comment above.
  const existingDeposit = await prisma.investorTransaction.findUnique({
    where: { txHash: ZAND_SEED_DEPOSIT_TXHASH },
    select: { positionId: true },
  });

  if (existingDeposit?.positionId) {
    const existingPosition = await prisma.position.findUnique({
      where: { id: existingDeposit.positionId },
      select: { accruedYieldUsdc: true },
    });
    return {
      created: false,
      positionId: existingDeposit.positionId,
      accumulatedBtcValueUsdc: existingPosition?.accruedYieldUsdc?.toNumber() ?? 0,
      distributedUsdc: ZAND_FIXTURE_DISTRIBUTED_USDC,
    };
  }

  // ── Build the fixture ───────────────────────────────────────────────
  const vault = await prisma.vaultDeployment.findUnique({
    where: { id: VAULT_DEPLOYMENT_ID },
    select: { id: true },
  });
  const vaultDeploymentId = vault?.id ?? null;

  const position = await prisma.$transaction(async (tx) => {
    const created = await tx.position.create({
      data: {
        investorId,
        vaultDeploymentId,
        vaultKey: ZAND_FIXTURE_VAULT_KEY,
        principalUsdc: ZAND_FIXTURE_PRINCIPAL_USDC,
        // Estimated USD value of BTC accumulated-to-date (capitalized, delivered
        // at maturity). NOT distributed cash, NOT a guaranteed return.
        accruedYieldUsdc: ZAND_FIXTURE_ACCUMULATED_BTC_VALUE_USDC,
        // A SERIES 1 mining note never distributes cash periodically.
        distributedUsdc: ZAND_FIXTURE_DISTRIBUTED_USDC,
        status: "active",
        subscribedAt: SUBSCRIBED_AT,
      },
    });

    // The ONLY ledger row: the opening deposit. No distribution rows.
    await tx.investorTransaction.create({
      data: {
        investorId,
        positionId: created.id,
        type: "deposit",
        amountUsdc: ZAND_FIXTURE_PRINCIPAL_USDC,
        occurredAt: SUBSCRIBED_AT,
        // Idempotency marker (unique column) — see ZAND_SEED_DEPOSIT_TXHASH.
        txHash: ZAND_SEED_DEPOSIT_TXHASH,
      },
    });

    return created;
  });

  return {
    created: true,
    positionId: position.id,
    accumulatedBtcValueUsdc: ZAND_FIXTURE_ACCUMULATED_BTC_VALUE_USDC,
    distributedUsdc: ZAND_FIXTURE_DISTRIBUTED_USDC,
  };
}
