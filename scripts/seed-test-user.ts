/**
 * Seeds an idempotent test investor used by the real-login E2E spec
 * (e2e/login-flow.spec.ts). The password is hashed via the SAME
 * @node-rs/argon2 parameters as the runtime (src/lib/auth/password.ts +
 * prisma/seed.ts) so `verifyPassword` in the login server action
 * succeeds on the first try.
 *
 * Hard-refused in production: this user MUST never exist in a prod DB.
 *
 *   pnpm seed:test
 *
 * Run before `pnpm test:e2e` (or wire into Playwright globalSetup). The
 * spec re-uses the constants exported here so the email/password stay in
 * lockstep.
 */
import { hash } from "@node-rs/argon2";

import { makePrismaClient } from "./lib/prisma-cli";

// Must match src/lib/auth/password.ts ARGON2_OPTIONS exactly.
const ALGORITHM_ARGON2ID = 2;
const ARGON2_OPTIONS = {
  algorithm: ALGORITHM_ARGON2ID,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

export const TEST_USER_EMAIL = "test@hearst.local";
export const TEST_USER_PASSWORD = "TestPassword123!";

async function main(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "seed-test-user.ts refuses to run in production. " +
        "This account is for local + E2E use only.",
    );
  }

  const prisma = makePrismaClient();
  try {
    const passwordHash = await hash(TEST_USER_PASSWORD, ARGON2_OPTIONS);

    const user = await prisma.user.upsert({
      where: { email: TEST_USER_EMAIL },
      update: { passwordHash, role: "investor" },
      create: {
        email: TEST_USER_EMAIL,
        passwordHash,
        role: "investor",
        investor: {
          create: {
            kycStatus: "approved",
          },
        },
      },
      include: { investor: true },
    });

    console.log(
      `[seed-test-user] ready: ${user.email} (id=${user.id}, investorId=${user.investor?.id ?? "—"})`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("[seed-test-user] failed:", err);
  process.exit(1);
});
