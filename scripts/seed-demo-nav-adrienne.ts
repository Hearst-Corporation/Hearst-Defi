/**
 * DEMO-ONLY, TEMPORARY: seed daily InvestorNavSnapshot rows for the $11 demo
 * account (adriennejkovic@gmail.com) so the hero portfolio chart shows a real
 * one-point-per-day climbing curve instead of a flat ledger reconstruction.
 *
 * ⚠️ These are FAKE values on a real-looking account living on the DEMO database.
 *    They are throwaway QA fixtures — DELETE them with the wipe command below.
 *
 *   Seed:  PRISMA_PROVIDER=postgresql DATABASE_URL=<direct-5432> \
 *            pnpm tsx scripts/seed-demo-nav-adrienne.ts
 *   Wipe:  PRISMA_PROVIDER=postgresql DATABASE_URL=<direct-5432> \
 *            pnpm tsx scripts/seed-demo-nav-adrienne.ts --wipe
 *
 * The loader DISCARDS a constant NAV series (distinctValues < 2 → it reconstructs
 * from the ledger), so every day carries a DISTINCT value. Span kept under the
 * resolver's 70-day monthly threshold so the x-axis stays day-precise.
 */
import { makePrismaClient } from "./lib/prisma-cli";

const EMAIL = "adriennejkovic@gmail.com";
const DAY_MS = 24 * 60 * 60 * 1000;
const DAYS = 30;
// Climb from a low base up to the account's headline value ($11 seed balance).
const END_VALUE = 11;
const START_VALUE = 6;

function utcDayPoint(d: number): Date {
  const ref = new Date(Date.now() - d * DAY_MS);
  return new Date(
    Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate(), 16, 0, 0, 0),
  );
}

async function main() {
  const wipe = process.argv.includes("--wipe");
  const prisma = makePrismaClient();
  try {
    const user = await prisma.user.findUnique({
      where: { email: EMAIL },
      include: { investor: true },
    });
    const investorId = user?.investor?.id;
    if (!investorId) throw new Error(`No investor for ${EMAIL}`);

    if (wipe) {
      const del = await prisma.investorNavSnapshot.deleteMany({
        where: { investorId, source: "demo_fake" },
      });
      console.log(`✓ wiped ${del.count} demo_fake NAV snapshots for ${EMAIL}`);
      return;
    }

    // Idempotent: clear our own prior demo rows first.
    await prisma.investorNavSnapshot.deleteMany({
      where: { investorId, source: "demo_fake" },
    });

    const step = (END_VALUE - START_VALUE) / DAYS;
    let written = 0;
    for (let d = DAYS; d >= 0; d--) {
      const at = utcDayPoint(d);
      // Deterministic ±2% wobble so the curve breathes (still finishes at END_VALUE).
      const wobble = (((d * 53) % 7) - 3) / 100;
      const raw =
        d === 0 ? END_VALUE : (START_VALUE + (DAYS - d) * step) * (1 + wobble);
      const value = Math.round(raw * 100) / 100; // cents precision for a small balance
      await prisma.investorNavSnapshot.upsert({
        where: { investorId_takenAt: { investorId, takenAt: at } },
        create: { investorId, takenAt: at, valueUsdc: value, source: "demo_fake" },
        update: { valueUsdc: value, source: "demo_fake" },
      });
      written++;
    }
    console.log(`✓ seeded ${written} DEMO daily NAV snapshots for ${EMAIL}`);
    console.log(`  climb $${START_VALUE} → $${END_VALUE} over ${DAYS} days (source=demo_fake)`);
    console.log(`  ⚠️ FAKE values — wipe with:  pnpm tsx scripts/seed-demo-nav-adrienne.ts --wipe`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
