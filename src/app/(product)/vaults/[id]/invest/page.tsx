// /vaults/[id]/invest — Step 3 of 4: Deposit
// Server Component. Reads vault from Prisma. Guards non-live vaults.
// Non-negotiable #1: APY range displayed via <ApyRange> inside InvestForm.
// Non-negotiable #3: PTAI projection mandatory — delegated to InvestForm.
// Non-negotiable #5: no forbidden words in any copy.
// Non-negotiable #10: disclaimer present in InvestForm and DepositSummary.

import { notFound } from "next/navigation";

import { getVault } from "@/lib/data/vaults";
import { getInvestor } from "@/lib/auth/session";
import { isDemoInvestor } from "@/lib/demo/provider";
import { buildDemoVaultDetail } from "@/lib/demo/builders";
import { DEMO_SANDBOX_DISCLAIMER } from "@/lib/demo/markers";
import { DemoDataBanner } from "@/components/product/demo-data-banner";
import { InvestFlowShell } from "@/components/vaults/invest-flow-shell";
import { InvestForm } from "@/components/vaults/invest-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Deposit — Hearst Yield Vault",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function InvestPage({ params }: PageProps) {
  const { id } = await params;
  const investor = await getInvestor();
  const demo = isDemoInvestor(investor);
  const vault = demo ? buildDemoVaultDetail(id) : await getVault(id);

  if (!vault) notFound();
  if (vault.status !== "live") notFound();

  return (
    <InvestFlowShell
      step="deposit"
      title="Deposit"
      description={
        <span className="body-sm ct-text-muted">
          {vault.name} · {vault.ticker}
        </span>
      }
      footer={
        <p className="body-xs ct-text-faint ct-prose-xl">
          {vault.disclaimers} APY ranges are target projections based on
          stated assumptions — they are not a projection of future returns
          and are subject to change without notice. Subject to minimum
          subscription of ${(vault.minTicketUsdc / 1_000).toFixed(0)}k,
          {vault.softLockupDays}-day soft lock-up, and jurisdictional
          restrictions. Methodology v1.0.
        </p>
      }
    >
      {demo ? (
        <DemoDataBanner message={DEMO_SANDBOX_DISCLAIMER} className="mb-4" />
      ) : null}
      <InvestForm vault={vault} demo={demo} />
    </InvestFlowShell>
  );
}
