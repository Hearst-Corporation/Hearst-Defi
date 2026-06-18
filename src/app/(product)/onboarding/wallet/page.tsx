/**
 * Step 3 — Wallet binding (optional). Persists via bindWallet.
 */

import { EmptySurface } from "@/components/ui/empty-surface";
import { WalletChamber } from "@/components/onboarding/privy-wallet-connect";
import { Card } from "@/components/ui/card";
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
      <Card className="product-doc-stack" data-testid="onboarding-wallet">
        <div className="product-doc-stack--tight">
          <p className="eyebrow ct-text-muted m-0">Onboarding · Step 3 of 3</p>
          <h1 className="h1 m-0">Connect your wallet</h1>
          <p className="body-md ct-text-muted m-0 text-pretty ct-prose-md">
            Identity verification is temporarily unavailable. Please try again
            later or contact support.
          </p>
        </div>
        <EmptySurface
          live
          variant="inline"
          message="Verification service unavailable"
          detail="The KYC gate cannot run until database migrations are applied."
        />
      </Card>
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
