/**
 * Local/dev bootstrap for the Zandbank demo account.
 *
 * Creates (or updates) the Zand demo login + investor profile, then seeds the
 * canonical $2M SERIES 1 mining-note fixture position (idempotent) — capital
 * deposited, allocated B1/B2/B3 (40/27/33), accumulating BTC value over a
 * 24-month term, delivered at maturity. NO periodic distribution, NO APY.
 *
 * Safety:
 * - hard-refused in NODE_ENV=production
 * - still inherits scripts/lib/prisma-cli.ts prod guard
 */
import { hash } from "@node-rs/argon2";

import { seedZandFixturePosition, ZAND_FIXTURE_EMAIL } from "../src/lib/demo/zand-fixture";
import { makePrismaClient } from "./lib/prisma-cli";
import { loadProjectEnv } from "./lib/load-env.mjs";

loadProjectEnv();

const ARGON2_OPTIONS = {
  algorithm: 2,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

const DEMO_PASSWORD = process.env.ZANDBANK_DEMO_PASSWORD ?? "DemoZand2026!";

function fmtUsd(v: number): string {
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "seed-zandbank-demo-local.ts refuses to run with NODE_ENV=production.",
    );
  }

  const prisma = makePrismaClient();
  try {
    const passwordHash = await hash(DEMO_PASSWORD, ARGON2_OPTIONS);

    const user = await prisma.user.upsert({
      where: { email: ZAND_FIXTURE_EMAIL },
      update: { role: "investor", passwordHash },
      create: {
        email: ZAND_FIXTURE_EMAIL,
        role: "investor",
        passwordHash,
        investor: {
          create: {
            email: ZAND_FIXTURE_EMAIL,
            kycStatus: "approved",
            accreditationAttestedAt: new Date(),
          },
        },
      },
      include: { investor: true },
    });

    const investor =
      user.investor ??
      (await prisma.investor.create({
        data: {
          userId: user.id,
          email: ZAND_FIXTURE_EMAIL,
          kycStatus: "approved",
          accreditationAttestedAt: new Date(),
        },
      }));

    if (user.investor) {
      await prisma.investor.update({
        where: { id: investor.id },
        data: {
          email: ZAND_FIXTURE_EMAIL,
          kycStatus: "approved",
          accreditationAttestedAt: investor.accreditationAttestedAt ?? new Date(),
        },
      });
    }

    const seeded = await seedZandFixturePosition(prisma, investor.id);

    console.log("── Zandbank local bootstrap ───────────────────────────────");
    console.log(`email                 ${ZAND_FIXTURE_EMAIL}`);
    console.log(`userId                ${user.id}`);
    console.log(`investorId            ${investor.id}`);
    console.log(`password              ${DEMO_PASSWORD}`);
    console.log(
      seeded.created
        ? `fixture               created (${seeded.positionId}, SERIES 1)`
        : `fixture               already present (${seeded.positionId}, SERIES 1)`,
    );
    console.log(`accumulated BTC value ${fmtUsd(seeded.accumulatedBtcValueUsdc)} (Estimated, delivered at maturity)`);
    console.log(`distributed           ${fmtUsd(seeded.distributedUsdc)} (0 — no periodic distribution)`);
    console.log("────────────────────────────────────────────────────────────");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("[seed-zandbank-demo-local] failed:", err);
  process.exit(1);
});
