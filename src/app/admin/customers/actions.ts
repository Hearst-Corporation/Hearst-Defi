"use server";

import { randomBytes } from "node:crypto";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/require-admin";
import { recordAdminAudit } from "@/lib/admin/audit";
import { hashPassword } from "@/lib/auth/password";
import {
  linkQualificationByEmail,
  applyCalibrationToUser,
} from "@/lib/agents/qualification";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getVault } from "@/lib/data/vaults";
import {
  MAX_SUBSCRIBE_USDC as MAX_DEPLOY_USDC,
  validateMinTicket,
  createPositionInTransaction,
  CapacityError,
} from "@/lib/positions/subscribe-logic";

/**
 * Admin KYC override. Lets a compliance officer (admin) set an investor's
 * `kycStatus` manually — the legitimate ops path AND the test path that unblocks
 * `subscribe()` for a pilot user without weakening the production gate (the gate
 * still requires `kycStatus === "approved"`; this is just who can flip it).
 *
 * Admin-only: re-asserts requireAdmin() inside the action (Server Actions are a
 * public RPC surface, so the /admin layout guard is not sufficient on its own).
 */
const Input = z.object({
  investorId: z.string().min(1),
  status: z.enum(["pending", "approved", "rejected"]),
});

export async function setInvestorKyc(formData: FormData): Promise<void> {
  const admin = await requireAdmin();

  const parsed = Input.safeParse({
    investorId: formData.get("investorId"),
    status: formData.get("status"),
  });
  if (!parsed.success) {
    throw new Error("setInvestorKyc: invalid input");
  }

  // Snapshot the prior KYC status before the override so the audit log captures
  // the exact compliance transition (before → after).
  const existing = await prisma.investor.findUnique({
    where: { id: parsed.data.investorId },
    select: { kycStatus: true },
  });
  if (!existing) {
    throw new Error("setInvestorKyc: investor not found");
  }

  // Atomic: the KYC override and its audit row commit together, so the trail can
  // never disagree with the actual mutation. The audit insert mirrors
  // recordAdminAudit()'s exact fields/shape, run on the transaction client.
  await prisma.$transaction(async (tx) => {
    await tx.investor.update({
      where: { id: parsed.data.investorId },
      data: { kycStatus: parsed.data.status },
    });

    await recordAdminAudit({
      actorWallet: admin.walletAddress ?? admin.userId,
      action: "investor.setKyc",
      entityType: "Investor",
      entityId: parsed.data.investorId,
      before: { kycStatus: existing.kycStatus },
      after: { kycStatus: parsed.data.status },
    }, tx);
  });

  revalidatePath("/admin/customers");
}

// ---------------------------------------------------------------------------
// Create investor (admin-provisioned account)
// ---------------------------------------------------------------------------

const CreateInvestorInput = z.object({
  email: z.string().trim().email().max(200),
  role: z.enum(["investor", "admin"]).default("investor"),
  kycStatus: z.enum(["pending", "approved", "rejected"]).default("pending"),
});

/**
 * Admin-provisions a new account: a User + its Investor profile. No password is
 * set by the admin — a random unusable hash is stored so the account exists
 * (for qualification / agent calibration) but cannot be logged into until the
 * person completes a password reset. Redirects to the new customer's detail.
 *
 * Admin-only: Server Actions are a public RPC surface, so requireAdmin() is
 * re-asserted here, not just relied on from the /admin layout.
 */
export async function createInvestor(formData: FormData): Promise<void> {
  const admin = await requireAdmin();

  const parsed = CreateInvestorInput.safeParse({
    email: formData.get("email"),
    role: formData.get("role") ?? "investor",
    kycStatus: formData.get("kycStatus") ?? "pending",
  });
  if (!parsed.success) throw new Error("createInvestor: invalid input");

  const existing = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true },
  });
  if (existing) throw new Error("An account with this email already exists");

  // Random, unusable password hash — login stays disabled until reset.
  const passwordHash = await hashPassword(randomBytes(24).toString("hex"));

  const user = await prisma.user.create({
    data: {
      email: parsed.data.email.trim().toLowerCase(),
      passwordHash,
      role: parsed.data.role,
      investor: {
        create: {
          email: parsed.data.email.trim().toLowerCase(),
          kycStatus: parsed.data.kycStatus,
        },
      },
    },
    include: { investor: true },
  });

  // Orphan Typeform submission filled before account existed → link + calibrate.
  try {
    const linked = await linkQualificationByEmail(user.id, user.email);
    if (linked) await applyCalibrationToUser(user.id);
  } catch {
    /* best-effort — account creation must not fail */
  }

  await recordAdminAudit({
    actorWallet: admin.walletAddress ?? admin.userId,
    action: "investor.create",
    entityType: "Investor",
    entityId: user.investor?.id ?? user.id,
    before: null,
    after: { email: parsed.data.email, role: parsed.data.role, kycStatus: parsed.data.kycStatus },
  });

  revalidatePath("/admin/customers");
  if (user.investor) {
    redirect(`/admin/customers/${user.investor.id}`);
  }
  redirect("/admin/customers");
}

// ---------------------------------------------------------------------------
// Deploy position (admin-created off-chain position for a target investor)
// ---------------------------------------------------------------------------

const DeployPositionInput = z.object({
  investorId: z.string().min(1),
  amountUsdc: z.coerce.number().positive().finite(),
  classCode: z.enum(["A", "B"]),
});

export type DeployPositionResult =
  | { ok: true; positionId: string }
  | { ok: false; error: string };

/**
 * Admin path to open an off-chain position for a specific investor — the
 * "deploy" action that lets a demo or pilot investor see a filled cockpit
 * without requiring a real on-chain deposit.
 *
 * Mirrors subscribe()'s core position-creation logic (capacity check,
 * share-class minimum, $transaction + nested InvestorTransaction) but operates
 * on an arbitrary investorId chosen by the admin rather than the current
 * session investor.
 *
 * Guards:
 *  - requireAdmin() — re-asserted here; /admin layout is not sufficient for a
 *    public Server Action RPC surface.
 *  - KYC must be "approved" — we do NOT auto-approve; the admin must set KYC
 *    first via setInvestorKyc().
 *  - Share-class minimum ticket enforced (Class A: $250k, Class B: $1M).
 *    In non-production with DEMO_MIN_TICKET_USDC set, the minimum is
 *    overridden to that value so a small demo position is allowed in dev/staging.
 *  - Vault capacity check runs inside the transaction (same as subscribe()).
 *  - txHashOpen is null (off-chain path; SQL allows multiple NULLs as distinct).
 */
export async function deployPosition(
  formData: FormData,
): Promise<DeployPositionResult> {
  const admin = await requireAdmin();

  const parsed = DeployPositionInput.safeParse({
    investorId: formData.get("investorId"),
    amountUsdc: formData.get("amountUsdc"),
    classCode: formData.get("classCode"),
  });
  if (!parsed.success) {
    return { ok: false, error: "deployPosition: invalid input" };
  }
  const { investorId, amountUsdc, classCode } = parsed.data;

  // Hard ceiling check (Zod already rejects NaN/Infinity/negatives via .positive().finite()).
  if (amountUsdc > MAX_DEPLOY_USDC) {
    return { ok: false, error: "Amount too large." };
  }

  // Resolve the target investor — must exist, be KYC-approved, and accredited.
  // Gap 3: select accreditationAttestedAt to enforce the attestation gate.
  // Gap 4: select user.email to detect the demo identity before any DB write.
  const investor = await prisma.investor.findUnique({
    where: { id: investorId },
    select: {
      id: true,
      kycStatus: true,
      accreditationAttestedAt: true,
      user: { select: { email: true } },
    },
  });
  if (!investor) {
    return { ok: false, error: "Investor not found." };
  }
  if (investor.kycStatus !== "approved") {
    return {
      ok: false,
      error:
        "KYC approval required. Approve the investor's KYC first, then deploy the position.",
    };
  }

  // Gap 3 — accreditation gate (mirrors subscribe line 75-77).
  if (!investor.accreditationAttestedAt) {
    return {
      ok: false,
      error: "Investor has not attested accreditation yet.",
    };
  }

  // Share-class minimum ticket check.
  const minTicketCheck = validateMinTicket(
    amountUsdc,
    classCode,
    process.env.NODE_ENV === "development",
  );
  if (!minTicketCheck.ok) {
    return minTicketCheck;
  }

  // Gap 2 — vault-status gate (mirrors subscribe lines 88-94).
  // Resolve the vault product via getVault so we can check its status.
  // The fixture id "hearst-yield-vault" may not have a VaultDeployment DB row;
  // getVault returns null in that case → skip the live gate but keep the
  // existing VaultDeployment fallback below for capacity.
  const VAULT_ID = "hearst-yield-vault";
  const vault = await getVault(VAULT_ID);
  if (vault !== null && vault.status !== "live") {
    return { ok: false, error: "This vault is not open for subscription." };
  }

  // Capacity check + position write in one atomic transaction.
  // Re-derive consumed capacity from live active principal (not a stale cache)
  // so concurrent admin deploys cannot both pass a stale `remaining` value.
  try {
    const deployment = await prisma.vaultDeployment.findUnique({
      where: { id: VAULT_ID },
      select: { id: true, capacityUsdc: true },
    });

    // For capacity ceiling: use the VaultDeployment row when it exists, otherwise
    // fall back to a generous ceiling so the fixture path never hard-blocks a demo.
    const capacityUsdc =
      deployment?.capacityUsdc?.toNumber() ?? 1_000_000_000;

    const position = await prisma.$transaction(async (tx) => {
      const created = await createPositionInTransaction(tx, {
        investorId,
        vaultId: VAULT_ID,
        amountUsdc,
        classCode,
        capacityUsdc,
        deploymentId: deployment?.id ?? null,
        txHash: null,
      });

      await recordAdminAudit({
        actorWallet: admin.walletAddress ?? admin.userId,
        action: "investor.deployPosition",
        entityType: "Investor",
        entityId: investorId,
        before: null,
        after: {
          positionId: created.id,
          vaultKey: `${VAULT_ID}:class-${classCode}`,
          amountUsdc,
          classCode,
          offChain: true,
        },
      }, tx);

      return created;
    });

    revalidatePath("/portfolio");
    revalidatePath("/admin/customers");
    revalidatePath(`/admin/customers/${investorId}`);
    return { ok: true, positionId: position.id };
  } catch (err) {
    if (err instanceof CapacityError) {
      return { ok: false, error: "Amount exceeds remaining vault capacity." };
    }
    throw err;
  }
}
