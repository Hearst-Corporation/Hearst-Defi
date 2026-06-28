/**
 * Step 3 — Wallet binding (optional). Persists via bindWallet.
 */

import { EmptySurface } from "@/components/ui/empty-surface";
import { WalletChamber } from "@/components/onboarding/privy-wallet-connect";
import { getInvestor } from "@/lib/auth/session";
import { PRIVY_APP_ID } from "@/lib/auth/privy-config";
import { requireWalletStepAccess } from "@/lib/onboarding/gates";

export const dynamic = "force-dynamic";

export default async function WalletPage() {
  const gateStatus = await requireWalletStepAccess();

  const investor = await getInvestor();
  const walletBound = (investor?.walletAddress ?? "").length > 0;

  if (gateStatus === "db_unavailable") {
    return (
      <section
        className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-sm overflow-hidden flex flex-col mx-auto w-full max-w-2xl"
        data-testid="onboarding-wallet"
      >
        <div className="flex flex-col gap-2 p-5 border-b border-[var(--ct-border-soft)]">
          <p className="ct-bento-label">Onboarding · Step 3 of 3</p>
          <h1 className="h1">Connect your wallet</h1>
          <p className="body-sm text-pretty">
            Identity verification is temporarily unavailable. Please try again
            later or contact support.
          </p>
        </div>
        <div className="p-5 lg:p-6">
          <EmptySurface
            live
            variant="inline"
            message="Verification service unavailable"
            detail="The KYC gate cannot run until database migrations are applied."
          />
        </div>
      </section>
    );
  }

  return (
    <WalletChamber
      appId={PRIVY_APP_ID}
      boundAddress={investor?.walletAddress ?? null}
      walletBound={walletBound}
    />
  );
}
