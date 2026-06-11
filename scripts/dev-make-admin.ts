/**
 * TEMP dev-only helper: promote the dev-bypass user to admin so
 * DEV_AUTH_BYPASS=1 can reach /admin/* (requireAdmin). Reversible — delete this
 * file after use. NEVER run against production.
 */
import { makePrismaClient } from "./lib/prisma-cli";

const DEV_USER_EMAIL = process.env.DEV_USER_EMAIL ?? "dev@hearst.local";

async function main() {
  const prisma = makePrismaClient();
  const user = await prisma.user.upsert({
    where: { email: DEV_USER_EMAIL },
    update: { role: "admin" },
    create: {
      email: DEV_USER_EMAIL,
      passwordHash: "!dev-bypass-no-password-login!",
      role: "admin",
      investor: { create: {} },
    },
    select: { id: true, email: true, role: true },
  });
  console.log("dev admin ready:", user);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
