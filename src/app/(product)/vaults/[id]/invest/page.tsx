import { notFound } from "next/navigation";

import { InvestFlowShell } from "@/components/vaults/invest-flow-shell";
import { InvestForm } from "@/components/vaults/invest-form";
import { getVault } from "@/lib/data/vaults";
import { getInvestor, getSession } from "@/lib/auth/session";
import type { Investor } from "@prisma/client";
import type { SessionUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Allocate capital — Hearst Yield Vault",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function InvestDepositPage({ params }: PageProps) {
  const { id } = await params;
  const [vault, investor, session] = await Promise.all([
    getVault(id),
    getInvestor(),
    getSession(),
  ]);

  if (!vault || vault.status !== "live") notFound();

  return (
    <InvestFlowShell
      step="deposit"
      width="full"
      title="Allocate capital"
      description={
        <span className="body-sm ct-text-muted">
          {vault.name} · {vault.ticker} · institutional subscription checkout on Base Sepolia testnet
        </span>
      }
      headerBelowStepper={
        <p className="body-xs ct-text-muted vault-invest-step-context">
          Step 3 of 4 · Review allocation amount, wallet readiness, and confirm deposit
        </p>
      }
    >
      <InvestForm
        vault={vault}
        investor={investor as Investor | null}
        session={session as SessionUser | null}
      />
    </InvestFlowShell>
  );
}
