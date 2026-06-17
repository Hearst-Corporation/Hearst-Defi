import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { VaultForm, type FormState } from "@/app/admin/vaults/_vault-form";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth/require-admin";
import { parseStringArray } from "@/lib/admin/parse-string-array";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata = { title: "Edit Vault Draft — Hearst Connect" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditVaultPage({ params }: PageProps) {
  const admin = await requireAdmin();
  const { id } = await params;
  const adminId = admin.walletAddress ?? admin.userId;

  const vault = await prisma.vaultDeployment.findUnique({ where: { id } });

  if (!vault) notFound();

  if (vault.status !== "draft") {
    redirect(`/admin/vaults/${id}`);
  }

  // Map DB row → FormState for pre-population
  let stored: string[];
  try {
    stored = parseStringArray(vault.signersWhitelist, "signer whitelist");
  } catch {
    stored = [];
  }
  const signersWhitelist =
    stored.length >= 2 ? stored : [...stored, ...Array(2 - stored.length).fill("")];

  const initial: FormState = {
    ticker: vault.ticker,
    name: vault.name,
    description: vault.description ?? "",
    strategy: vault.strategy as FormState["strategy"],
    colorTag: vault.colorTag ?? "accent",
    minTicketUsdc: Number(vault.minTicketUsdc),
    capacityUsdc: Number(vault.capacityUsdc),
    mgmtFeeBps: vault.mgmtFeeBps,
    perfFeeBps: vault.perfFeeBps,
    hurdleBps: vault.hurdleBps,
    softLockupDays: vault.softLockupDays,
    targetApyLowBps: vault.targetApyLowBps,
    targetApyHighBps: vault.targetApyHighBps,
    spvJurisdiction: vault.spvJurisdiction as FormState["spvJurisdiction"],
    shareClass: vault.shareClass,
    regExemption: vault.regExemption as FormState["regExemption"],
    disclaimers: vault.disclaimers,
    targetMiningBps: vault.targetMiningBps,
    targetBtcTacticalBps: vault.targetBtcTacticalBps,
    targetUsdcBaseBps: vault.targetUsdcBaseBps,
    targetStableReserveBps: vault.targetStableReserveBps,
    signersWhitelist,
    requiredSigners: Math.max(2, Math.min(vault.requiredSigners, signersWhitelist.length)),
  };

  return (
    <div className="admin-doc-shell">
      <AdminPageHeader
        lead={
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/admin/vaults/${id}`}>← {vault.ticker}</Link>
          </Button>
        }
        title="Edit Vault Draft"
      />

      <VaultForm mode="edit" vaultId={id} initial={initial} adminId={adminId} />
    </div>
  );
}
