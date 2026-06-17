"use server";

import { randomBytes } from "node:crypto";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/require-admin";
import { hashPassword } from "@/lib/auth/password";
import {
  linkQualificationByEmail,
  applyCalibrationToUser,
} from "@/lib/agents/qualification";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

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

    await tx.adminAudit.create({
      data: {
        actorWallet: admin.walletAddress ?? admin.userId,
        action: "investor.setKyc",
        entityType: "Investor",
        entityId: parsed.data.investorId,
        diff: JSON.stringify({
          before: { kycStatus: existing.kycStatus },
          after: { kycStatus: parsed.data.status },
        }),
        ip: null,
        userAgent: null,
      },
    });
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

  await prisma.adminAudit.create({
    data: {
      actorWallet: admin.walletAddress ?? admin.userId,
      action: "investor.create",
      entityType: "Investor",
      entityId: user.investor?.id ?? user.id,
      diff: JSON.stringify({
        before: null,
        after: { email: parsed.data.email, role: parsed.data.role, kycStatus: parsed.data.kycStatus },
      }),
      ip: null,
      userAgent: null,
    },
  });

  revalidatePath("/admin/customers");
  if (user.investor) {
    redirect(`/admin/customers/${user.investor.id}`);
  }
  redirect("/admin/customers");
}
