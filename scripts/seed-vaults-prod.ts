// One-shot prod seeder for the 3 VaultDeployment rows (idempotent upsert).
// Decoupled from prisma/seed.ts so we never trigger resetTables() in prod.
//
// USAGE (run AFTER flipping schema provider to postgresql):
//   ALLOW_PROD_WRITES=1 PRISMA_PROVIDER=postgresql DATABASE_URL='postgresql://...' \
//     pnpm exec tsx scripts/seed-vaults-prod.ts
//
// This script is LEGITIMATELY prod-facing, so it opts in through the prisma-cli
// prod guard with ALLOW_PROD_WRITES=1 (see scripts/lib/prisma-cli.ts).
//
// SAFE: only touches the 3 well-known VaultDeployment ids
// (hearst-yield-vault, hearst-defensive-vault, hearst-btc-plus-vault).
// Existing rows are upserted, never deleted. Other tables are untouched.

import { makePrismaClient } from "./lib/prisma-cli";

import {
  VAULT_YIELD,
  VAULT_DEFENSIVE,
  VAULT_BTC_PLUS,
  type VaultDefinition,
} from "../src/lib/engine/vaults";

interface VaultFixture {
  id: string;
  status: "live" | "review";
  strategy: "mining_yield" | "btc_tactical" | "stable_reserve";
  definition: VaultDefinition;
}

const FIXTURES: VaultFixture[] = [
  { id: "hearst-yield-vault", status: "live", strategy: "mining_yield", definition: VAULT_YIELD },
  { id: "hearst-defensive-vault", status: "review", strategy: "stable_reserve", definition: VAULT_DEFENSIVE },
  { id: "hearst-btc-plus-vault", status: "review", strategy: "btc_tactical", definition: VAULT_BTC_PLUS },
];

async function main(): Promise<void> {
  const prisma = makePrismaClient();
  let count = 0;
  try {
    for (const f of FIXTURES) {
      const d = f.definition;
      const a = d.allocationTargets;
      const classA = d.shareClasses[0];
      const data = {
        ticker: `${d.ticker}-A`,
        name: d.label,
        description: d.description,
        strategy: f.strategy,
        colorTag: "accent",
        status: f.status,
        minTicketUsdc: classA?.minTicketUsdc ?? 250_000,
        capacityUsdc: 100_000_000,
        mgmtFeeBps: classA?.mgmtFeeBps ?? 200,
        perfFeeBps: classA?.perfFeeBps ?? 1000,
        hurdleBps: classA?.hurdleBps ?? 0,
        softLockupDays: classA?.softLockupDays ?? 60,
        targetApyLowBps: Math.round(d.apyTarget.low * 100),
        targetApyHighBps: Math.round(d.apyTarget.high * 100),
        spvJurisdiction: "cayman",
        shareClass: "A",
        regExemption: "regS",
        disclaimers: d.assumptions.join(" "),
        targetMiningBps: a.mining * 100,
        targetBtcTacticalBps: a.btc_tactical * 100,
        targetUsdcBaseBps: a.usdc_base * 100,
        targetStableReserveBps: a.stable_reserve * 100,
        requiredSigners: 2,
        signersWhitelist: JSON.stringify(["multisig:0xAAA", "multisig:0xBBB"]),
        createdBy: "seed-vaults-prod",
      };
      await prisma.vaultDeployment.upsert({
        where: { id: f.id },
        update: data,
        create: { id: f.id, ...data },
      });
      count++;
      console.log(`[seed-vaults-prod] upserted ${f.id} (${data.ticker})`);
    }
    console.log(`[seed-vaults-prod] done: ${count} VaultDeployment rows`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("[seed-vaults-prod] FAILED:", err);
  process.exit(1);
});
