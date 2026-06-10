/**
 * QA bootstrap (LOCAL/DEV ONLY) — inventories data + forges sessions so a
 * headless runtime QA pass can hit every protected route with curl.
 *
 * Prints two `hc_session` tokens (admin + investor) and a data inventory with
 * concrete IDs for dynamic routes ([id]/[positionId]/[slug]).
 *
 * Reversible: sessions can be deleted with `pnpm tsx scripts/qa-bootstrap.ts --cleanup`.
 */
import { randomBytes } from "crypto";

import { makePrismaClient } from "./lib/prisma-cli";

const prisma = makePrismaClient();
const TTL_MS = 24 * 60 * 60 * 1000;
const ADMIN_EMAIL = "qa-admin@hearst.local";

async function count(model: string): Promise<number> {
  try {
    // @ts-expect-error dynamic model access
    return await prisma[model].count();
  } catch {
    return -1;
  }
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("qa-bootstrap refuses to run in production.");
  }

  if (process.argv.includes("--cleanup")) {
    const del = await prisma.session.deleteMany({
      where: { user: { email: { in: [ADMIN_EMAIL] } } },
    });
    console.log(`[qa] cleaned ${del.count} qa sessions`);
    await prisma.$disconnect();
    return;
  }

  // --- 1. Users ----------------------------------------------------------
  const users = await prisma.user.findMany({
    select: { id: true, email: true, role: true },
    orderBy: { email: "asc" },
  });
  console.log("=== USERS ===");
  for (const u of users) console.log(`  ${u.role.padEnd(9)} ${u.email}  (${u.id})`);

  // --- 2. Data inventory -------------------------------------------------
  const models = [
    "VaultDeployment", "VaultDraft", "ShareClass", "Investor", "Position",
    "Subscription", "Distribution", "GovernanceProposal", "Proof",
    "RebalanceEvent", "MiningMetric", "VaultSnapshot", "Notification",
    "BacktestRun", "ScenarioRun", "KycInquiry", "ReviewDocument",
    "AddressAllowlist", "SavedView", "Pcap", "ReportExport",
  ];
  console.log("\n=== COUNTS ===");
  for (const m of models) {
    const lower = m.charAt(0).toLowerCase() + m.slice(1);
    console.log(`  ${m.padEnd(20)} ${await count(lower)}`);
  }

  // --- 3. Concrete IDs for dynamic routes --------------------------------
  console.log("\n=== SAMPLE IDS ===");
  const vault = await prisma.vaultDeployment.findFirst({ select: { id: true, vaultId: true, status: true } }).catch(() => null);
  console.log("  vaultDeployment:", JSON.stringify(vault));

  const proposal = await prisma.governanceProposal.findFirst({ select: { id: true, status: true } }).catch(() => null);
  console.log("  governanceProposal:", JSON.stringify(proposal));

  // investor with the most positions (best data for portfolio QA)
  const investors = await prisma.investor.findMany({
    select: { id: true, userId: true, _count: { select: { positions: true } } },
  }).catch(() => []);
  const richest = investors.sort((a, b) => b._count.positions - a._count.positions)[0];
  console.log("  richest investor:", JSON.stringify(richest));

  let positionId: string | null = null;
  if (richest) {
    const pos = await prisma.position.findFirst({ where: { investorId: richest.id }, select: { id: true } }).catch(() => null);
    positionId = pos?.id ?? null;
  }
  console.log("  positionId:", positionId);

  // --- 4. Forge sessions -------------------------------------------------
  // Admin: reuse an existing admin, else provision a QA admin.
  let adminUser = users.find((u) => u.role === "admin") ?? null;
  if (!adminUser) {
    const created = await prisma.user.upsert({
      where: { email: ADMIN_EMAIL },
      update: { role: "admin" },
      create: { email: ADMIN_EMAIL, passwordHash: "!qa-admin-no-login!", role: "admin" },
      select: { id: true, email: true, role: true },
    });
    adminUser = created;
    console.log(`\n[qa] provisioned QA admin: ${created.email}`);
  }

  // Investor: prefer the richest investor's user, else any investor user.
  let investorUserId = richest?.userId ?? null;
  if (!investorUserId) {
    const anyInv = users.find((u) => u.role === "investor");
    investorUserId = anyInv?.id ?? null;
  }

  async function forge(userId: string): Promise<string> {
    const token = randomBytes(32).toString("hex");
    await prisma.session.create({
      data: { id: token, userId, expiresAt: new Date(Date.now() + TTL_MS) },
    });
    return token;
  }

  const adminToken = await forge(adminUser.id);
  const investorToken = investorUserId ? await forge(investorUserId) : null;

  console.log("\n=== SESSION TOKENS (hc_session) ===");
  console.log("ADMIN_TOKEN=" + adminToken);
  console.log("INVESTOR_TOKEN=" + (investorToken ?? "NONE"));
  console.log("ADMIN_EMAIL=" + adminUser.email);
  console.log("INVESTOR_USER_ID=" + (investorUserId ?? "NONE"));

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("[qa-bootstrap] failed:", e);
  await prisma.$disconnect();
  process.exit(1);
});
