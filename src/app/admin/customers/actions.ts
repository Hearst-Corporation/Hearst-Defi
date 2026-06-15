"use server";

import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/require-admin";
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
