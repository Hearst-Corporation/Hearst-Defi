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

    // 6. DAILY NAV prints for chart QA — ONE point per day over `DAYS_OF_NAV` days,
    //    with a real (varying) climb so the hero chart reads as an honest daily
    //    series, not a dead-flat line. The loader DISCARDS a constant NAV series
    //    (distinctValues < 2 → it reconstructs from the ledger), so every day MUST
    //    carry a distinct value: start near the opening principal and accrue yield
    //    one day at a time toward today's live NAV. Kept under the resolver's
    //    70-day monthly threshold so the x-axis stays day-precise ("last N days").
    const DAY_MS = 24 * 60 * 60 * 1000;
    const DAYS_OF_NAV = 60;
    // Linear daily accrual from the opening principal to the current total value.
    const startValue = PRINCIPAL;
    const dailyStep = (value - startValue) / DAYS_OF_NAV;

    /** UTC midnight `d` days before today. */
    function utcMidnightDaysAgo(d: number): Date {
      const ref = new Date(Date.now() - d * DAY_MS);
      return new Date(
        Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate(), 16, 0, 0, 0),
      );
    }

    await prisma.investorNavSnapshot.deleteMany({ where: { investorId } });
    for (let d = DAYS_OF_NAV; d >= 0; d--) {
      const at = utcMidnightDaysAgo(d);
      // Deterministic ±0.15% wobble so the curve breathes without lying.
      const wobble = (((d * 53) % 7) - 3) / 1000;
      const dayValue =
        d === 0
          ? value // last point = exact live NAV
          : Math.round((startValue + (DAYS_OF_NAV - d) * dailyStep) * (1 + wobble));
      await prisma.investorNavSnapshot.upsert({
        where: { investorId_takenAt: { investorId, takenAt: at } },
        create: {
          investorId,
          takenAt: at,
          valueUsdc: dayValue,
          source: "dev_seed",
        },
        update: { valueUsdc: dayValue, source: "dev_seed" },
      });
    }

    console.log("✓ Dev position seeded for", DEV_EMAIL);
    console.log(`  position ${position.id}`);
    console.log(
      `  principal $${PRINCIPAL.toLocaleString()} · accrued $${ACCRUED.toLocaleString()} · distributed $${distributed.toLocaleString()}`,
    );
    console.log(`  value $${value.toLocaleString()} · ${MONTHS_OF_HISTORY} monthly distributions`);
    console.log(`  daily NAV prints: ${DAYS_OF_NAV + 1} rows (dev_seed, varying)`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
