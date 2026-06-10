/**
 * S4 — Wallet binding page.
 *
 * Uses the real Privy wallet-connect component when NEXT_PUBLIC_PRIVY_APP_ID
 * is configured. Falls back to a "Configuration en attente" state when the
 * key is absent — the page never crashes.
 *
 * Non-negotiable #5: no forbidden words.
 */

import Link from "next/link";

import { ProductPageHeader } from "@/components/connect/product-page-header";
import { Button } from "@/components/ui/button";
import { PrivyWalletConnect } from "@/components/onboarding/privy-wallet-connect";

export const dynamic = "force-dynamic";

export default function WalletPage() {
  // NEXT_PUBLIC_* vars are inlined at build time by Next.js; we read them here
  // on the server so we can pass a plain string prop to the client component
  // (avoids a double read on the client and keeps the logic in the Server Component).
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";

  return (
    <div className="ct-card w-full max-w-lg flex flex-col gap-[var(--ct-space-6)]">
      <ProductPageHeader
        className="gap-2"
        eyebrow="Step 4 of 7"
        title="Connect Your Wallet"
        description={
          <>
            Link the wallet address that will receive your USDC distributions.
            This wallet will also be the signing key for on-chain position management.
          </>
        }
      />

      {/* Privy wallet connect — real embed when appId present, config-pending fallback otherwise */}
      <PrivyWalletConnect appId={appId} />

      {/* Navigation */}
      <div className="flex flex-col gap-[var(--ct-space-3)]">
        <Button variant="primary" size="lg" asChild className="w-full font-bold">
          <Link href="/onboarding/review?step=review">
            Continue to Review
          </Link>
        </Button>
        <Button variant="ghost" size="md" asChild className="w-full">
          <Link href="/onboarding/identity?step=identity">
            ← Back
          </Link>
        </Button>
      </div>

      <p className="body-xs ct-text-faint text-pretty">
        You can update your distribution wallet after onboarding via your Profile
        settings. Hearst Connect does not custody funds between deposit and vault
        allocation.
      </p>
    </div>
  );
}
