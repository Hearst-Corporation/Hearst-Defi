import { notFound } from "next/navigation";

import { InvestFlowShell } from "@/components/vaults/invest-flow-shell";
import { InvestForm } from "@/components/vaults/invest-form";
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
  const vault = await getVault(id);

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
      <InvestForm vault={vault} />
    </InvestFlowShell>
  );
}
