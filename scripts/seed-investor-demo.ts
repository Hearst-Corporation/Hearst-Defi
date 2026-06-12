/**
 * Local investor visual-QA seed — dev/staging only.
 *
 * Populates test@hearst.local with a demo position, profile fields, vault
 * contract (Base Sepolia testnet), and minimal vault snapshot / paper proofs
 * when the DB is empty.
 *
 *   pnpm seed:investor-demo
 *
 * Full admin timeline (30d snapshots, mining, rebalances):
 *   pnpm db:seed && pnpm seed:investor-demo
 *
 * Reset fixture + demo investor rows:
 *   pnpm seed:investor-demo:reset
 *
 * On-chain Proof Center (PoR attestation, events) also needs in .env.local:
 *   NEXT_PUBLIC_EVENT_LOGGER_ADDRESS=0xb07E045D082d202bAc7C1d4F83e1A63d00653D9E
 *   NEXT_PUBLIC_POR_REGISTRY_ADDRESS=0x2B7229Ea0c94f12D984d9045ee12fB0D2Efcd28D
 */
import { hash } from "@node-rs/argon2";

import {
  MOCK_ATTESTOR_ADDRESS,
  signMockAttestation,
} from "../src/lib/attestation/mock";
import {
  buildDemoPosition,
  buildDemoVaultSnapshot,
  canSeedInvestorDemo,
  DEMO_ALLOCATION_BUCKETS,
  DEMO_INVESTOR_EMAIL,
  DEMO_MARKER,
  DEMO_POSITION_ID,
  DEMO_TX_HASHES,
  DEMO_WALLET,
  DEMO_YIELD_VAULT_CONTRACT,
  DEMO_YIELD_VAULT_ID,
} from "../src/lib/dev/investor-demo";
import { TEST_USER_EMAIL, TEST_USER_PASSWORD } from "./seed-test-user";
import { makePrismaClient } from "./lib/prisma-cli";

const ARGON2_OPTIONS = {
  algorithm: 2,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

const prisma = makePrismaClient();

function monthsAgo(n: number, from: Date): Date {
  return new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth() - n, 15, 12, 0, 0),
  );
}

async function ensureTestUser(): Promise<{ userId: string; investorId: string }> {
  const passwordHash = await hash(TEST_USER_PASSWORD, ARGON2_OPTIONS);
  const user = await prisma.user.upsert({
    where: { email: TEST_USER_EMAIL },
    update: { passwordHash, role: "investor" },
    create: {
      email: TEST_USER_EMAIL,
      passwordHash,
      role: "investor",
    },
    include: { investor: true },
  });

  const investor =
    user.investor ??
    (await prisma.investor.create({
      data: { userId: user.id, email: TEST_USER_EMAIL },
    }));

  await prisma.investor.update({
    where: { id: investor.id },
    data: {
      email: TEST_USER_EMAIL,
      kycStatus: "approved",
      walletAddress: DEMO_WALLET,
      accreditationAttestedAt: new Date(),
    },
  });

  return { userId: user.id, investorId: investor.id };
}

async function ensureYieldVaultDeployment(): Promise<void> {
  const existing = await prisma.vaultDeployment.findUnique({
    where: { id: DEMO_YIELD_VAULT_ID },
  });

  if (existing) {
    await prisma.vaultDeployment.update({
      where: { id: DEMO_YIELD_VAULT_ID },
      data: {
        status: "live",
        network: "84532",
        contractAddress: DEMO_YIELD_VAULT_CONTRACT,
      },
    });
    return;
  }

  await prisma.vaultDeployment.create({
    data: {
      id: DEMO_YIELD_VAULT_ID,
      ticker: "HYV-A",
      name: "Hearst Yield Vault",
      description: `${DEMO_MARKER} — mining-backed structured yield.`,
      strategy: "mining_yield",
      status: "live",
      network: "84532",
      contractAddress: DEMO_YIELD_VAULT_CONTRACT,
      minTicketUsdc: 250_000,
      capacityUsdc: 100_000_000,
      mgmtFeeBps: 200,
      perfFeeBps: 1000,
      hurdleBps: 600,
      softLockupDays: 60,
      targetApyLowBps: 940,
      targetApyHighBps: 1280,
      spvJurisdiction: "cayman",
      shareClass: "A",
      regExemption: "regD_506c",
      disclaimers: DEMO_MARKER,
      targetMiningBps: 6000,
      targetBtcTacticalBps: 1500,
      targetUsdcBaseBps: 1500,
      targetStableReserveBps: 1000,
      requiredSigners: 2,
      signersWhitelist: JSON.stringify(["multisig:0xAAA", "multisig:0xBBB"]),
      createdBy: "demo-seed",
    },
  });
}

async function ensureVaultSnapshot(): Promise<string | null> {
  const latest = await prisma.vaultSnapshot.findFirst({
    orderBy: { takenAt: "desc" },
    select: { id: true },
  });
  if (latest) return latest.id;

  const row = buildDemoVaultSnapshot(new Date());
  const snap = await prisma.vaultSnapshot.create({
    data: row,
  });

  for (const bucket of DEMO_ALLOCATION_BUCKETS) {
    await prisma.allocation.create({
      data: {
        snapshotId: snap.id,
        bucket: bucket.bucket,
        pct: bucket.pct,
        valueUsdc: row.aumUsdc * (bucket.pct / 100),
        yieldContributionBps: bucket.yieldContributionBps,
      },
    });
  }

  console.log(`  VaultSnapshot:   1 demo snapshot + ${DEMO_ALLOCATION_BUCKETS.length} allocations`);
  return snap.id;
}

async function ensurePaperProofs(): Promise<number> {
  const count = await prisma.proof.count();
  if (count > 0) return 0;

  const now = new Date();
  const period = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const signed = await signMockAttestation(period, {}, now);

  await prisma.proof.create({
    data: {
      proofType: "mining_attestation",
      period,
      hash: signed.digest,
      uri: signed.payload.evidenceCid,
      postedAt: now,
      postedBy: `${DEMO_MARKER} · ${MOCK_ATTESTOR_ADDRESS.slice(0, 6)}…`,
      signer: signed.payload.attestor,
      signature: signed.signature,
      payloadJson: JSON.stringify(signed.payload),
      notes: DEMO_MARKER,
    },
  });

  await prisma.proof.create({
    data: {
      proofType: "custody",
      period,
      hash: "0x" + "c".repeat(64),
      uri: "ipfs://demo-custody-snapshot",
      postedAt: now,
      postedBy: DEMO_MARKER,
      notes: DEMO_MARKER,
    },
  });

  await prisma.proof.create({
    data: {
      proofType: "methodology",
      period: null,
      hash: "0x" + "d".repeat(64),
      uri: "/docs/methodology/v1.0.md",
      postedAt: now,
      postedBy: DEMO_MARKER,
      notes: DEMO_MARKER,
    },
  });

  console.log("  Proof:           3 demo paper proofs (mining, custody, methodology)");
  return 3;
}

async function seedDemoInvestorPosition(investorId: string): Promise<void> {
  const now = new Date();
  const subscribedAt = monthsAgo(4, now);

  await prisma.investorTransaction.deleteMany({
    where: {
      OR: [
        { positionId: DEMO_POSITION_ID },
        { txHash: { in: Object.values(DEMO_TX_HASHES) } },
      ],
    },
  });
  await prisma.position.deleteMany({ where: { id: DEMO_POSITION_ID } });

  const position = buildDemoPosition(investorId, subscribedAt);
  await prisma.position.create({ data: position });

  await prisma.investorTransaction.create({
    data: {
      id: "demo-tx-deposit",
      investorId,
      positionId: DEMO_POSITION_ID,
      type: "deposit",
      amountUsdc: position.principalUsdc,
      txHash: DEMO_TX_HASHES.deposit,
      occurredAt: subscribedAt,
    },
  });

  const distributions = [
    { id: "demo-tx-dist-1", monthsBack: 3, amount: 4_200, hash: DEMO_TX_HASHES.distribution1 },
    { id: "demo-tx-dist-2", monthsBack: 2, amount: 5_800, hash: DEMO_TX_HASHES.distribution2 },
    { id: "demo-tx-dist-3", monthsBack: 1, amount: 8_000, hash: DEMO_TX_HASHES.distribution3 },
  ] as const;

  for (const d of distributions) {
    await prisma.investorTransaction.create({
      data: {
        id: d.id,
        investorId,
        positionId: DEMO_POSITION_ID,
        type: "distribution",
        amountUsdc: d.amount,
        txHash: d.hash,
        occurredAt: monthsAgo(d.monthsBack, now),
      },
    });
  }

  console.log("  Position:        1 active demo position ($500k principal)");
  console.log("  Transactions:    1 deposit + 3 distributions");
}

async function main(): Promise<void> {
  if (!canSeedInvestorDemo()) {
    console.error(
      "[seed-investor-demo] Refusing in production. Set ALLOW_INVESTOR_DEMO_SEED=true to override.",
    );
    process.exit(1);
  }

  console.log(`[seed-investor-demo] ${DEMO_MARKER}`);
  console.log(`  Login: ${DEMO_INVESTOR_EMAIL} / (see scripts/seed-test-user.ts)`);

  const { investorId } = await ensureTestUser();
  await ensureYieldVaultDeployment();
  await ensureVaultSnapshot();
  await ensurePaperProofs();
  await seedDemoInvestorPosition(investorId);

  console.log("");
  console.log("Done. Visual QA checklist:");
  console.log("  /portfolio   — position, yield, calendar, risk/proof widgets");
  console.log("  /vaults      — Hearst Yield Vault card (Base Sepolia contract)");
  console.log("  /proof-center — paper proofs grid; on-chain needs .env.local chain addresses");
  console.log("  /profile     — KYC approved, accreditation, investment summary");
  console.log("");
  console.log("Reset: pnpm seed:investor-demo:reset");
  console.log("Richer admin data: pnpm db:seed && pnpm seed:investor-demo");
}

main()
  .catch((err: unknown) => {
    console.error("[seed-investor-demo] failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
