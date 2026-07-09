/**
 * One-shot demo seeder for the Zand institutional demo account
 * (zand.demo@hearstcorporation.io — see src/lib/demo/allowlist.ts).
 *
 * Zand currently has ZERO Position / InvestorTransaction / Distribution rows,
 * so the portfolio data layer (loadPortfolioDashboard, see
 * src/lib/data/portfolio-cockpit.ts — `hasPosition = positions.length > 0`)
 * falls back to the PILOT fixtures, always badged "Simulated". This script
 * plants a real, institutional-sized position + a 12-month distribution
 * ledger so the portfolio flips PILOT → REAL for this account, with numbers
 * shaped like the existing PILOT_DISTRIBUTION_BARS trajectory in
 * src/app/(product)/portfolio/page.tsx (so the visual story stays coherent
 * once real data takes over from the simulated fixture).
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
  ZAND_FIXTURE_MONTHLY_DISTRIBUTIONS_USDC,
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

    console.log("── Zand demo seed ───────────────────────────────────────────");
    console.log(`investor              ${ZAND_EMAIL} (investor ${investorId})`);
    console.log(`principal             ${fmtUsd(ZAND_FIXTURE_PRINCIPAL_USDC)}`);
    console.log(
      `distributions         ${ZAND_FIXTURE_MONTHLY_DISTRIBUTIONS_USDC.length} monthly rows, total ${fmtUsd(ZAND_FIXTURE_MONTHLY_DISTRIBUTIONS_USDC.reduce((sum, v) => sum + v, 0))}`,
    );

    const result = await seedZandFixturePosition(prisma, investorId);

    console.log("");
    if (!result.created) {
      console.log(`── already applied, skipping ────────────────────────────────`);
      console.log(`position (existing)   ${result.positionId}`);
      console.log(`total distributed     ${fmtUsd(result.distributedUsdc)}`);
      console.log("");
      console.log("Nothing written. Re-run is safe — this script is idempotent.");
      return;
    }

    console.log(`✓ Created position ${result.positionId}.`);
    console.log(`  Distributions totalling ${fmtUsd(result.distributedUsdc)}.`);
    console.log(`  Portfolio will now render REAL data for ${ZAND_EMAIL} (hasPosition=true).`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
