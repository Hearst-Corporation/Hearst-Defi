/**
 * Seeds an idempotent test admin used by the E2E specs that require admin
 * privileges (e.g., e2e/outreach-master-agent.spec.ts).
 * The password is hashed via the SAME @node-rs/argon2 parameters as the
 * runtime (src/lib/auth/password.ts) so verifyPassword succeeds.
 *
 * Hard-refused in production: this user MUST never exist in a prod DB.
 *
 *   pnpm seed:test:admin
 *
 * Run before `pnpm test:e2e` — called automatically by CI after seed:test.
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

// Match the E2E test credentials in e2e/outreach-master-agent.spec.ts
export const TEST_ADMIN_EMAIL = "admin@hearst.io";
export const TEST_ADMIN_PASSWORD = "TestAdmin123!";

async function main(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "seed-test-admin.ts refuses to run in production. " +
        "This account is for local + E2E use only.",
    );
  }

  const prisma = makePrismaClient();
  try {
    const passwordHash = await hash(TEST_ADMIN_PASSWORD, ARGON2_OPTIONS);

    const user = await prisma.user.upsert({
      where: { email: TEST_ADMIN_EMAIL },
      update: { passwordHash, role: "admin" },
      create: {
        email: TEST_ADMIN_EMAIL,
        passwordHash,
        role: "admin",
      },
    });

    console.log(
      `[seed-test-admin] ready: ${user.email} (id=${user.id}, role=${user.role})`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("[seed-test-admin] failed:", err);
  process.exit(1);
});
