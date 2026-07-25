import { notFound, redirect } from "next/navigation";

import { getVault } from "@/lib/data/vaults";
import { getInvestor, getSession } from "@/lib/auth/session";
import { isSumsubConfigured } from "@/lib/onboarding/config";
import { resolveKycWalletGate } from "@/lib/onboarding/kyc-gate";
import { InvestDepositView } from "@/views/investor/invest-deposit-view";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Allocate capital — Series 1 Reserve Vault",
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
    <InvestDepositView
      vault={vault}
      investor={investor}
      session={session}
    />
  );
}
