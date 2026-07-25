import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { VaultForm, type FormState } from "@/app/admin/vaults/_vault-form";
import { AdminPageShell, AdminSectionCard, FORM_SURFACE } from "@/components/admin/admin-page-shell";
import { AlertBanner } from "@/components/admin/alert-banner";
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
  let whitelistCorrupted = false;
  try {
    stored = parseStringArray(vault.signersWhitelist, "signer whitelist");
  } catch {
    stored = [];
    whitelistCorrupted = true;
  }
  const signersWhitelist =
    stored.length >= 2 ? stored : [...stored, ...Array(2 - stored.length).fill("")];

  // The STORED quorum, shown as stored — never silently rewritten. When it is
  // incoherent (fewer stored signers than the quorum requires, or below the
  // 2-signer floor) the banner below SAYS so instead of patching the value.
  const storedRequiredSigners = vault.requiredSigners;
  const quorumIncoherence: string | null =
    storedRequiredSigners < 2
      ? `Stored quorum is ${storedRequiredSigners} — below the 2-signer minimum. The value is shown as stored; fix it in the Governance step before submitting.`
      : storedRequiredSigners > stored.length
        ? `Stored quorum requires ${storedRequiredSigners} signers but only ${stored.length} signer(s) are stored in the whitelist. The value is shown as stored; add signers or lower the quorum in the Governance step before submitting.`
        : null;

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
    requiredSigners: storedRequiredSigners,
  };

  return (
    <AdminPageShell
      titleLead="Edit"
      titleAccent="Vault Draft"
      contextLabel={vault.ticker}
      headerActions={
        <Link
          href={`/admin/vaults/${id}`}
          className="ct-metric-caption rounded-sm transition-colors hover:text-[var(--ct-text-strong)]"
        >
          ← {vault.ticker}
        </Link>
      }
    >
      <AdminSectionCard
        ariaLabel="Vault draft"
        title="Vault draft"
        subtitle="Edit this vault's parameters, share classes, and assumptions before publishing."
      >
        {whitelistCorrupted ? (
          <AlertBanner tone="warning" role="alert" className="mx-5 mt-5">
            Stored signer whitelist could not be read (invalid data) — the field below starts
            empty, not a copy of what&apos;s saved. Re-enter signers before submitting to avoid
            overwriting the existing whitelist unintentionally.
          </AlertBanner>
        ) : null}
        {quorumIncoherence ? (
          <AlertBanner tone="warning" className="mx-5 mt-5" title="Stored quorum is incoherent">
            {quorumIncoherence}
          </AlertBanner>
        ) : null}
        <div className={FORM_SURFACE}>
          <VaultForm mode="edit" vaultId={id} initial={initial} adminId={adminId} />
        </div>
      </AdminSectionCard>
    </AdminPageShell>
  );
}
