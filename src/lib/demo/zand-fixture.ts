// NOTE: intentionally NOT `import "server-only"` — this module takes a
// PrismaClient as a parameter (never imports the app db client) and is shared
// between Server Actions (demoSeedZandFixture) AND the standalone CLI seed
// script (prisma/seed-zand-demo.ts). The `server-only` guard would crash the
// CLI. The real server boundary lives on the callers.
import type { PrismaClient } from "@prisma/client";

/**
 * Shared fixture-position builder for the Zand institutional demo account
 * (zand.demo@hearstcorporation.io). The exact same position + deposit +
 * 12-month distribution ledger can be (re)created from TWO callers:
 *
 *   1. `prisma/seed-zand-demo.ts` — the one-shot CLI seeder (keeps its own
 *      prod-write guard, main(), and console narration; only the DB logic
 *      lives here).
 *   2. `demoSeedZandFixture` (portfolio demo-actions) — the in-app
 *      "Seed $2M fixture" lever on the demo timeline control, so the $2M
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
 * the share-class terms (60-day soft lock-up, distribution cadence, etc.); a
 * non-matching key would make the lock-up meter fall back to "stale".
 * Idempotency is tracked separately, via ZAND_SEED_DEPOSIT_TXHASH below (a
 * unique column), never via this vaultKey.
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

/** Institutional demo ticket size for Zand. */
export const ZAND_FIXTURE_PRINCIPAL_USDC = 2_000_000;

/** Fixed, deterministic anchor — 2025-01-01 UTC. No Date.now(), no PRNG. */
const SUBSCRIBED_AT = new Date(Date.UTC(2025, 0, 1, 0, 0, 0, 0));

/**
 * 12 monthly distributions — a ~9-12% APY trajectory on a $2M ticket, roughly
 * $15k-$21k/month, deterministic. Entry i is the payout FOR month i of 2025
 * (Jan…Dec), PAID on the 1st of the FOLLOWING month (Feb 2025 … Jan 2026,
 * UTC): a subscription dated 2025-01-01 cannot have already paid out on its
 * own subscription day.
 */
export const ZAND_FIXTURE_MONTHLY_DISTRIBUTIONS_USDC: readonly number[] = [
  15_800, // for Jan — paid Feb 1
  16_500, // for Feb — paid Mar 1
  17_700, // for Mar — paid Apr 1
  17_200, // for Apr — paid May 1
  18_500, // for May — paid Jun 1
  18_200, // for Jun — paid Jul 1
  19_200, // for Jul — paid Aug 1
  18_800, // for Aug — paid Sep 1
  20_000, // for Sep — paid Oct 1
  19_500, // for Oct — paid Nov 1
  20_700, // for Nov — paid Dec 1
  21_100, // for Dec — paid Jan 1 2026
];

/** Paid on the 1st of the month AFTER the earned month (Date.UTC rolls Dec+1 into Jan 2026). */
function distributionDate(monthIndex0: number): Date {
  return new Date(Date.UTC(2025, monthIndex0 + 1, 1, 0, 0, 0, 0));
}

export interface ZandFixtureSeedResult {
  /** True when a new position was created; false when the fixture already existed (idempotent no-op). */
  created: boolean;
  positionId: string;
  distributedUsdc: number;
}

/**
 * (Re-)creates the Zand fixture position — 1 Position ($2M principal), 1
 * deposit InvestorTransaction, and 12 monthly distribution
 * InvestorTransaction rows — for `investorId`, inside a single `$transaction`.
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
    const distAgg = await prisma.investorTransaction.aggregate({
      where: { positionId: existingDeposit.positionId, type: "distribution" },
      _sum: { amountUsdc: true },
    });
    return {
      created: false,
      positionId: existingDeposit.positionId,
      distributedUsdc: distAgg._sum.amountUsdc?.toNumber() ?? 0,
    };
  }

  // ── Build the fixture ───────────────────────────────────────────────
  const totalDistributed = ZAND_FIXTURE_MONTHLY_DISTRIBUTIONS_USDC.reduce(
    (sum, v) => sum + v,
    0,
  );

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
        accruedYieldUsdc: 0,
        distributedUsdc: totalDistributed,
        status: "active",
        subscribedAt: SUBSCRIBED_AT,
      },
    });

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

    await tx.investorTransaction.createMany({
      data: ZAND_FIXTURE_MONTHLY_DISTRIBUTIONS_USDC.map((amountUsdc, i) => ({
        investorId,
        positionId: created.id,
        type: "distribution",
        amountUsdc,
        occurredAt: distributionDate(i),
      })),
    });

    return created;
  });

  return {
    created: true,
    positionId: position.id,
    distributedUsdc: totalDistributed,
  };
}
