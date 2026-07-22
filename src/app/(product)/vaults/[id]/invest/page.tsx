import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { InvestFlowShell } from "@/components/vaults/invest-flow-shell";
import { InvestForm } from "@/components/vaults/invest-form";
import { BtcCompositionPanel } from "@/components/vaults/vault-composition-panel";
import type { AllocationPocketViewModel } from "@/features/investor-ui/types/dashboard";
import { investProductPath } from "@/lib/vaults/invest-routes";
import { series1DisplayName } from "@/lib/vaults/series1";
import { getVault, type VaultProduct } from "@/lib/data/vaults";
import { getInvestor, getSession } from "@/lib/auth/session";
import { isSumsubConfigured } from "@/lib/onboarding/config";
import { resolveKycWalletGate } from "@/lib/onboarding/kyc-gate";
import type { Investor } from "@prisma/client";
import type { SessionUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Allocate capital — Series 1 Reserve Vault",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

// Series 1 pocket allocation (B1 Mining Power / B2 BTC Pouch / B3 Reserve USDC,
// 40/27/33) derived from the vault's own target basis points — where the
// subscribed USDC is deployed. actualBps null: the on-chain split is not yet
// indexed per vault, so the donut shows the product TARGET, never a fabricated
// actual. No borrow / LTV / liquidation anywhere on this surface.
function toSeries1Pockets(vault: VaultProduct): readonly AllocationPocketViewModel[] {
  return [
    { pocket: "B1", label: "Mining Power", targetBps: vault.targetMiningBps, actualBps: null },
    { pocket: "B2", label: "BTC Pouch", targetBps: vault.targetBtcTacticalBps, actualBps: null },
    {
      pocket: "B3",
      label: "Reserve USDC",
      targetBps: vault.targetStableReserveBps + vault.targetUsdcBaseBps,
      actualBps: null,
    },
  ];
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
      lead={
        <Link
          href={investProductPath(id)}
          className="body-sm ct-link-accent"
          aria-label="Back to term sheet"
        >
          ← Term sheet
        </Link>
      }
      titleLead="Allocate"
      titleAccent="capital"
      description={
        <span className="text-[length:var(--ct-text-xs)] text-[var(--ct-text-muted)]">
          {series1DisplayName(vault.name)} · {vault.ticker} · institutional subscription checkout on Base Sepolia testnet
        </span>
      }
      headerBelowStepper={
        <p className="text-[length:var(--ct-text-micro)] uppercase tracking-[0.1em] text-[var(--ct-text-faint)]">
          Review allocation amount, wallet readiness, and confirm deposit
        </p>
      }
    >
      {/* WHERE YOUR CAPITAL GOES — the three Series 1 pockets the subscribed
          USDC is deployed into (B1 Mining Power / B2 BTC Pouch / B3 Reserve
          USDC, 40/27/33). Sits ABOVE the checkout so the destination of the
          capital is visible before the amount is confirmed. Return is disclosed
          downstream ONLY as a range, in accumulated BTC, not guaranteed — this
          block makes no return promise. No borrow / LTV / liquidation. */}
      <section
        role="region"
        aria-label="Where your capital is deployed"
        className="flex flex-col gap-[var(--ct-space-3)]"
      >
        <div className="flex flex-col gap-1">
          <span className="ct-bento-label text-[var(--ct-text-muted)]">Where your capital goes</span>
          <p className="text-[length:var(--ct-text-xs)] text-[var(--ct-text-faint)]">
            Your USDC is deployed across three on-chain pockets to accumulate Bitcoin over
            the 24-month term. Estimated return is disclosed as an accumulated BTC delivery
            range at maturity — not guaranteed.
          </p>
        </div>
        <BtcCompositionPanel
          pockets={toSeries1Pockets(vault)}
          totalBtc={null}
          provenance="simulated"
        />
      </section>

      <InvestForm
        vault={vault}
        investor={investor as Investor | null}
        session={session as SessionUser | null}
      />
    </InvestFlowShell>
  );
}
