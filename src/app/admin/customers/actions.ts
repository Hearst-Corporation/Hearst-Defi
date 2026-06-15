"use server";

import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/require-admin";
import { recordAdminAudit } from "@/lib/admin/audit";
import { revalidatePath } from "next/cache";

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

  await prisma.investor.update({
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
  });

  revalidatePath("/admin/customers");
}
