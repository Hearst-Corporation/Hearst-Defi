import { notFound } from "next/navigation";

import { DemoDataBanner } from "@/components/product/demo-data-banner";
import { InvestFlowShell } from "@/components/vaults/invest-flow-shell";
import { InvestForm } from "@/components/vaults/invest-form";
import { getInvestor } from "@/lib/auth/session";
import { isDemoInvestor } from "@/lib/demo/provider";
import { buildDemoVaultDetail } from "@/lib/demo/builders";
import { DEMO_SANDBOX_DISCLAIMER } from "@/lib/demo/markers";
import { getVault } from "@/lib/data/vaults";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Deposit — Hearst Yield Vault",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function InvestDepositPage({ params }: PageProps) {
  const { id } = await params;
  const investor = await getInvestor();
  const demo = isDemoInvestor(investor);
  const vault = demo ? buildDemoVaultDetail(id) : await getVault(id);

  if (!vault || vault.status !== "live") notFound();

  return (
    <InvestFlowShell
      step="deposit"
      width="full"
      title="Deposit"
      description={
        <span className="body-sm ct-text-muted">
          {vault.name} · {vault.ticker} · review amount, pre-flight checks, and final confirmation
        </span>
      }
    >
      {demo ? (
        <DemoDataBanner message={DEMO_SANDBOX_DISCLAIMER} className="mb-[var(--ct-space-4)]" />
      ) : null}
      <InvestForm vault={vault} demo={demo} />
    </InvestFlowShell>
  );
}
