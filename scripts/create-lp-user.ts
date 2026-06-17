/**
 * One-off / dev helper: provision an LP (investor) account with a usable password.
 * Does NOT touch existing admin users.
 *
 *   pnpm tsx scripts/create-lp-user.ts
 *   LP_EMAIL=foo@bar.com LP_PASSWORD='Secret123!' pnpm tsx scripts/create-lp-user.ts
 */
import { hash } from "@node-rs/argon2";

import { makePrismaClient } from "./lib/prisma-cli";

const ARGON2_OPTIONS = {
  algorithm: 2,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

const EMAIL = process.env.LP_EMAIL?.trim() ?? "lp.demo@hearstcorporation.io";
const PASSWORD = process.env.LP_PASSWORD ?? "DemoLp2026!";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL?.trim() ?? "adrien@hearstcorporation.io";

async function main(): Promise<void> {
  const prisma = makePrismaClient();
  try {
    const admin = await prisma.user.findUnique({
      where: { email: ADMIN_EMAIL },
      select: { email: true, role: true },
    });
    if (!admin || admin.role !== "admin") {
      console.warn(`[create-lp-user] admin check: ${ADMIN_EMAIL} →`, admin);
    } else {
      console.log(`[create-lp-user] super admin OK: ${admin.email}`);
    }

    const passwordHash = await hash(PASSWORD, ARGON2_OPTIONS);
    const user = await prisma.user.upsert({
      where: { email: EMAIL },
      update: { passwordHash, role: "investor" },
      create: {
        email: EMAIL,
        passwordHash,
        role: "investor",
        investor: {
          create: { email: EMAIL, kycStatus: "approved" },
        },
      },
      include: { investor: true },
    });

    let investorId = user.investor?.id;
    if (!investorId) {
      const inv = await prisma.investor.create({
        data: { userId: user.id, email: EMAIL, kycStatus: "approved" },
      });
      investorId = inv.id;
    } else {
      await prisma.investor.update({
        where: { id: investorId },
        data: { kycStatus: "approved", email: EMAIL },
      });
    }

    const total = await prisma.investor.count();
    console.log(`[create-lp-user] investorId=${investorId} directoryTotal=${total}`);
    console.log(`[create-lp-user] login: ${EMAIL}`);
    console.log(`[create-lp-user] password: ${PASSWORD}`);
    console.log(`[create-lp-user] admin: /admin/customers/${investorId}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("[create-lp-user] failed:", err);
  process.exit(1);
});
