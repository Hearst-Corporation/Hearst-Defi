import { notFound, redirect } from "next/navigation";

import { InvestFlowShell } from "@/components/vaults/invest-flow-shell";
import { InvestForm } from "@/components/vaults/invest-form";
import { getVault } from "@/lib/data/vaults";
import { getInvestor, getSession } from "@/lib/auth/session";
import { isSumsubConfigured } from "@/lib/onboarding/config";
import { resolveKycWalletGate } from "@/lib/onboarding/kyc-gate";
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

  // Investing is the gated action. Entry to the platform is open (see
  // resolvePostLoginRedirect), but allocating capital requires the investor to
  // have completed onboarding first: accreditation attested, then KYC approved
  // when Sumsub is live. Un-onboarded investors are routed into the funnel here
  // (with ?from so they return to checkout once cleared) instead of at sign-in.
  const investFrom = `/vaults/${id}/invest`;
  if (!investor?.accreditationAttestedAt) {
    redirect(`/onboarding/accreditation?from=${encodeURIComponent(investFrom)}`);
  }
  if (isSumsubConfigured() && session?.userId) {
    const gate = await resolveKycWalletGate(session.userId);
    if (gate === "requires_identity") {
      redirect(`/onboarding/identity?from=${encodeURIComponent(investFrom)}`);
    }
  }

  return (
    <InvestFlowShell
      step="deposit"
      width="full"
      titleLead="Allocate"
      titleAccent="capital"
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
