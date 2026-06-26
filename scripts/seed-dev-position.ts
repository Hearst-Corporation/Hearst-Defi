/**
 * Dev-only: seed a realistic active Position (+ ledger) for the dev-bypass
 * investor (dev@hearst.local) so /portfolio lights up with full charts + numbers.
 *
 * Idempotent: wipes the dev investor's existing positions/transactions first,
 * then recreates a clean fixture. Safe to re-run. NEVER runs in production.
 *
 *   pnpm tsx scripts/seed-dev-position.ts
 *
 * Undo: pnpm tsx scripts/wipe-seeded-data.ts  (clears Position/InvestorTransaction)
 */
import { makePrismaClient } from "./lib/prisma-cli";

const DEV_EMAIL = process.env.DEV_USER_EMAIL ?? "dev@hearst.local";
const VAULT_ID = "hearst-yield-vault";

const PRINCIPAL = 500_000;
const ACCRUED = 9_800; // current cycle, not yet distributed
const MONTHLY_DISTRIB = 8_500; // ~ 5 months of monthly payouts
const MONTHS_OF_HISTORY = 5;

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

/** UTC last day of the month that is `monthsBack` months before now. */
function endOfMonthBack(monthsBack: number): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsBack + 1, 0, 16, 0, 0),
  );
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("seed-dev-position is dev-only");
  }

  const prisma = makePrismaClient();

  try {
    // 1. Ensure the dev investor (mirror ensureDevUser in src/lib/auth/session.ts).
    const user =
      (await prisma.user.findUnique({
        where: { email: DEV_EMAIL },
        include: { investor: true },
      })) ??
      (await prisma.user.create({
        data: {
          email: DEV_EMAIL,
          passwordHash: "!dev-bypass-no-password-login!",
          role: "investor",
          investor: { create: {} },
        },
        include: { investor: true },
      }));

    const investorId = user.investor?.id;
    if (!investorId) throw new Error("dev user has no investor row");

    // 2. Confirm the yield vault deployment exists (created by `pnpm db:seed`).
    const vault = await prisma.vaultDeployment.findUnique({
      where: { id: VAULT_ID },
    });
    if (!vault) {
      throw new Error(
        `VaultDeployment "${VAULT_ID}" not found — run \`pnpm db:seed\` first.`,
      );
    }

    // 3. Idempotent reset — wipe this investor's positions + ledger.
    await prisma.investorTransaction.deleteMany({ where: { investorId } });
    await prisma.position.deleteMany({ where: { investorId } });

    // 4. Create the active position.
    const subscribedAt = daysAgo(165);
    const distributed = MONTHLY_DISTRIB * MONTHS_OF_HISTORY;

    const position = await prisma.position.create({
      data: {
        investorId,
        vaultDeploymentId: VAULT_ID,
        vaultKey: `${VAULT_ID}:class-A`,
        principalUsdc: PRINCIPAL,
        accruedYieldUsdc: ACCRUED,
        distributedUsdc: distributed,
        status: "active",
        subscribedAt,
      },
    });

    // 5. Ledger: opening deposit + monthly distributions (most recent last).
    await prisma.investorTransaction.create({
      data: {
        investorId,
        positionId: position.id,
        type: "deposit",
        amountUsdc: PRINCIPAL,
        occurredAt: subscribedAt,
      },
    });

    for (let m = MONTHS_OF_HISTORY; m >= 1; m--) {
      // Small deterministic variation around the monthly average.
      const jitter = ((m * 137) % 9) * 60 - 240; // -240 … +240
      await prisma.investorTransaction.create({
        data: {
          investorId,
          positionId: position.id,
          type: "distribution",
          amountUsdc: MONTHLY_DISTRIB + jitter,
          occurredAt: endOfMonthBack(m),
        },
      });
    }

    const value = PRINCIPAL + ACCRUED;

    // 6. Hourly NAV prints for chart QA (flat at current NAV — honest dev fixture).
    const HOUR_MS = 60 * 60 * 1000;
    const hoursBack = 168;
    await prisma.investorNavSnapshot.deleteMany({ where: { investorId } });
    for (let h = hoursBack; h >= 0; h--) {
      const at = new Date(
        Date.UTC(
          new Date(Date.now() - h * HOUR_MS).getUTCFullYear(),
          new Date(Date.now() - h * HOUR_MS).getUTCMonth(),
          new Date(Date.now() - h * HOUR_MS).getUTCDate(),
          new Date(Date.now() - h * HOUR_MS).getUTCHours(),
          0,
          0,
          0,
        ),
      );
      await prisma.investorNavSnapshot.upsert({
        where: { investorId_takenAt: { investorId, takenAt: at } },
        create: {
          investorId,
          takenAt: at,
          valueUsdc: value,
          source: "dev_seed",
        },
        update: { valueUsdc: value, source: "dev_seed" },
      });
    }

    console.log("✓ Dev position seeded for", DEV_EMAIL);
    console.log(`  position ${position.id}`);
    console.log(
      `  principal $${PRINCIPAL.toLocaleString()} · accrued $${ACCRUED.toLocaleString()} · distributed $${distributed.toLocaleString()}`,
    );
    console.log(`  value $${value.toLocaleString()} · ${MONTHS_OF_HISTORY} monthly distributions`);
    console.log(`  hourly NAV prints: ${hoursBack + 1} rows (dev_seed)`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
