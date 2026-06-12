/**
 * Step 3 — Wallet binding (optional). Persists via bindWallet.
 */

import Link from "next/link";

import { ProductPageHeader } from "@/components/connect/product-page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AwaitingMetricState } from "@/components/portfolio/awaiting-metric-state";
import { PrivyWalletConnect } from "@/components/onboarding/privy-wallet-connect";
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
      <Card className="flex flex-col gap-6" data-testid="onboarding-wallet">
        <ProductPageHeader
          className="gap-2"
          eyebrow="Onboarding · Step 3 of 3"
          title="Connect your wallet"
          description="Identity verification is temporarily unavailable. Please try again later or contact support."
        />
        <AwaitingMetricState
          message="Verification service unavailable"
          detail="The KYC gate cannot run until database migrations are applied."
        />
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-6" data-testid="onboarding-wallet">
      <ProductPageHeader
        className="gap-2"
        eyebrow="Onboarding · Step 3 of 3"
        title="Connect your wallet"
        description={
          <>
            Link the wallet address that will receive your USDC distributions.
            This wallet will also be the signing key for on-chain position management.
          </>
        }
      />

      <PrivyWalletConnect
        appId={PRIVY_APP_ID}
        boundAddress={investor?.walletAddress ?? null}
      />

      <div className="flex flex-col gap-3">
        <p className="body-sm ct-text-faint m-0 text-pretty">
          Wallet binding is optional during onboarding. Connect above now or link
          one later from Profile.
        </p>
        <Button variant="primary" size="lg" asChild className="w-full font-bold">
          <Link href="/portfolio">
            {walletBound ? "Continue to portfolio" : "Continue without wallet"}
          </Link>
        </Button>
        <Button variant="ghost" size="md" asChild className="w-full">
          <Link href="/onboarding/identity">← Back</Link>
        </Button>
      </div>

      <p className="body-xs ct-text-faint text-pretty m-0">
        You can update your distribution wallet after onboarding via your Profile
        settings. Hearst Connect does not custody funds between deposit and vault
        allocation.
      </p>
    </Card>
  );
}
