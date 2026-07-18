/**
 * One-shot demo seeder for the Zand institutional demo account
 * (zand.demo@hearstcorporation.io — see src/lib/demo/allowlist.ts).
 *
 * Zand currently has ZERO Position / InvestorTransaction rows, so the portfolio
 * data layer (loadPortfolioDashboard, see src/lib/data/portfolio-cockpit.ts —
 * `hasPosition = positions.length > 0`) falls back to the PILOT fixtures,
 * always badged "Simulated". This script plants a real, institutional-sized
 * SERIES 1 mining-note position (Hearst Mining Note, methodology v3.0,
 * ADR-019): capital deposited, allocated across the 3 on-chain pockets
 * B1/B2/B3 (40/27/33), accumulating BTC value over a 24-month term and
 * delivered at maturity. There is NO periodic cash distribution and NO fixed
 * APY — the ledger holds a single opening `deposit`, ZERO distribution rows.
 *
 * IDEMPOTENT: re-running this script never duplicates data. Before writing,
 * it looks for the deposit InvestorTransaction already tagged with this
 * script's fixture marker (txHash === ZAND_SEED_DEPOSIT_TXHASH, a unique
 * column) — if found, it reports the existing rows and exits without
 * touching the DB.
 *
 * PROD GUARD: reuses `makePrismaClient()` from scripts/lib/prisma-cli.ts,
 * which refuses to construct a client against the production Supabase ref
 * (xrwzxhsenwmlxbwqcftz) unless ALLOW_PROD_WRITES=1 is set in the real
 * process env (see that file for the exact fail-closed mechanism). This
 * script does NOT re-implement the guard — it inherits it for free.
 *
 * NOT executed by this authoring pass. Adrien runs it explicitly:
 *
 *   # Local/dev DB (SQLite or a non-prod Postgres) — safe by default:
 *   pnpm exec tsx prisma/seed-zand-demo.ts
 *
 *   # Production (Supabase, ref xrwzxhsenwmlxbwqcftz) — explicit opt-in:
 *   ALLOW_PROD_WRITES=1 PRISMA_PROVIDER=postgresql \
 *     DATABASE_URL='<prod pooler/direct connection string>' \
 *     pnpm exec tsx prisma/seed-zand-demo.ts
 */
import { makePrismaClient } from "../scripts/lib/prisma-cli";
import {
  seedZandFixturePosition,
  ZAND_FIXTURE_ACCUMULATED_BTC_VALUE_USDC,
  ZAND_FIXTURE_POCKET_SPLIT,
  ZAND_FIXTURE_PRINCIPAL_USDC,
} from "../src/lib/demo/zand-fixture";

const ZAND_EMAIL = "zand.demo@hearstcorporation.io";

function fmtUsd(v: number): string {
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

async function main(): Promise<void> {
  const prisma = makePrismaClient();

  try {
    const user = await prisma.user.findUnique({
      where: { email: ZAND_EMAIL },
      include: { investor: true },
    });
    if (!user) {
      throw new Error(`No user found for email "${ZAND_EMAIL}"`);
    }
    const investorId = user.investor?.id;
    if (!investorId) {
      throw new Error(`User "${ZAND_EMAIL}" has no investor profile`);
    }

    console.log("── Zand demo seed — SERIES 1 mining note (v3.0) ─────────────");
    console.log(`investor              ${ZAND_EMAIL} (investor ${investorId})`);
    console.log(`principal             ${fmtUsd(ZAND_FIXTURE_PRINCIPAL_USDC)}`);
    console.log(
      `pockets               B1 ${ZAND_FIXTURE_POCKET_SPLIT.miningPowerPct}% / B2 ${ZAND_FIXTURE_POCKET_SPLIT.btcPouchPct}% / B3 ${ZAND_FIXTURE_POCKET_SPLIT.reserveUsdcPct}%`,
    );
    console.log(
      `accumulated BTC value ${fmtUsd(ZAND_FIXTURE_ACCUMULATED_BTC_VALUE_USDC)} (Estimated, delivered at maturity — no periodic distribution, no APY)`,
    );

    const result = await seedZandFixturePosition(prisma, investorId);

    console.log("");
    if (!result.created) {
      console.log(`── already applied, skipping ────────────────────────────────`);
      console.log(`position (existing)   ${result.positionId}`);
      console.log(`accumulated BTC value ${fmtUsd(result.accumulatedBtcValueUsdc)} (Estimated)`);
      console.log(`distributed           ${fmtUsd(result.distributedUsdc)} (0 — BTC accumulated, not distributed)`);
      console.log("");
      console.log("Nothing written. Re-run is safe — this script is idempotent.");
      return;
    }

    console.log(`✓ Created SERIES 1 position ${result.positionId}.`);
    console.log(`  Accumulated BTC value ${fmtUsd(result.accumulatedBtcValueUsdc)} (Estimated, delivered at maturity).`);
    console.log(`  Distributed ${fmtUsd(result.distributedUsdc)} — no periodic cash distribution.`);
    console.log(`  Portfolio will now render REAL data for ${ZAND_EMAIL} (hasPosition=true).`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
