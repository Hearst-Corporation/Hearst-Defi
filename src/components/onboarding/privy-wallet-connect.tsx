"use client";

/**
 * Privy wallet connect — persists Investor.walletAddress via bindWallet.
 */

import { usePrivy, useConnectWallet, useWallets } from "@privy-io/react-auth";
import Link from "next/link";
import { useEffect, useRef } from "react";

import {
  OnboardingChamber,
  OnboardingChamberSole,
  OnboardingRequirementsList,
  useOnboardingShell,
} from "@/components/onboarding/onboarding-chamber";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AwaitingMetricState } from "@/components/portfolio/awaiting-metric-state";
import { cn } from "@/lib/cn";
import { abbreviateAddress } from "@/lib/onchain";
import { bindWallet } from "@/lib/onboarding/actions";

interface PrivyWalletConnectProps {
  appId: string;
  boundAddress?: string | null;
}

function PrivyConnectInner({ boundAddress }: { boundAddress: string | null }) {
  const { ready, authenticated } = usePrivy();
  const { connectWallet } = useConnectWallet();
  const { wallets } = useWallets();
  const persistRef = useRef<string | null>(boundAddress?.toLowerCase() ?? null);

  const connectedWallet = wallets[0];
  const address = connectedWallet?.address ?? boundAddress;

  useEffect(() => {
    const next = connectedWallet?.address;
    if (!next) return;
    const normalized = next.toLowerCase();
    if (normalized === persistRef.current) return;

    persistRef.current = normalized;
    void bindWallet(next).then((result) => {
      if (!result.ok) {
        console.error("[PrivyWalletConnect] bindWallet failed:", result.error);
        persistRef.current = null;
      }
    });
  }, [connectedWallet?.address]);

  if (!ready) {
    return (
      <Card aria-busy="true" aria-label="Loading wallet connection">
        <AwaitingMetricState variant="inline" message="Loading wallet connection…" />
      </Card>
    );
  }

  if (authenticated && address) {
    return (
      <Card
        className="product-doc-stack--relaxed items-center text-center"
        role="region"
        aria-label="Wallet connected"
      >
        <Badge variant="success">
          <span
            aria-hidden="true"
            className="inline-block h-1.5 w-1.5 rounded-full bg-current"
          />
          Wallet linked
        </Badge>

        <p
          className={cn(
            "mono tabular body-sm ct-text-strong m-0",
            "rounded-md ct-border-soft px-4 py-2",
          )}
        >
          {abbreviateAddress(address)}
        </p>

        <p className="body-xs ct-text-faint text-pretty m-0 ct-prose-narrow">
          This wallet will receive your monthly USDC distributions and act as
          the signing key for on-chain position management.
        </p>
      </Card>
    );
  }

  return (
    <Card className="product-doc-stack--relaxed items-center text-center">
      <p className="body-sm ct-text-muted m-0 ct-prose-narrow">
        Link the wallet address that will receive your USDC distributions.
        Supported: MetaMask, Ledger, WalletConnect, Coinbase Wallet.
      </p>

      <Button
        type="button"
        variant="primary"
        size="lg"
        className="w-full"
        onClick={() => void connectWallet()}
      >
        Connect wallet
      </Button>

      <p className="body-xs ct-text-faint text-pretty m-0 ct-prose-narrow">
        Wallet binding is used solely for on-chain distribution delivery.
        No private keys are stored or transmitted.
      </p>
    </Card>
  );
}

export function PrivyWalletConnect({ appId, boundAddress = null }: PrivyWalletConnectProps) {
  if (!appId) {
    return (
      <AwaitingMetricState
        message="Wallet connection not configured"
        detail="Set NEXT_PUBLIC_PRIVY_APP_ID to enable Privy wallet binding."
      />
    );
  }

  return <PrivyConnectInner boundAddress={boundAddress} />;
}

interface WalletChamberProps {
  appId: string;
  boundAddress: string | null;
  walletBound: boolean;
}

/** Step 3 shell — Crown · Privy connect · Sole CTAs. */
export function WalletChamber({
  appId,
  boundAddress,
  walletBound,
}: WalletChamberProps) {
  const { checklist, irContact } = useOnboardingShell();

  return (
    <OnboardingChamber
      testId="onboarding-wallet"
      crown={
        <div className="product-doc-stack--tight">
          <p className="eyebrow ct-text-muted m-0">Onboarding · Step 3 of 3</p>
          <h1 className="h1 m-0">Connect your wallet</h1>
          <p className="body-md ct-text-muted m-0 text-pretty ct-prose-md">
            Link the wallet address that will receive your USDC distributions.
            This wallet will also be the signing key for on-chain position
            management.
          </p>
        </div>
      }
      body={
        <>
          <OnboardingRequirementsList items={checklist} />
          <PrivyWalletConnect appId={appId} boundAddress={boundAddress} />
        </>
      }
      sole={
        <OnboardingChamberSole
          irContact={irContact}
          compliance={
            <>
              You can update your distribution wallet after onboarding via your{" "}
              <Link href="/profile" className="ct-link-accent hover:underline">
                Profile
              </Link>{" "}
              settings. Hearst Connect does not custody funds between deposit
              and vault allocation.
            </>
          }
          actions={
            <div className="product-doc-stack--actions">
              <p className="body-sm ct-text-faint m-0 text-pretty text-center ct-prose-md">
                Wallet binding is optional during onboarding. Connect above now
                or link one later from{" "}
                <Link href="/profile" className="ct-link-accent hover:underline">
                  Profile
                </Link>
                .
              </p>
              <Button variant="primary" size="lg" asChild className="w-full">
                <Link href="/portfolio">
                  {walletBound ? "Continue to portfolio" : "Continue without wallet"}
                </Link>
              </Button>
              <Button variant="ghost" size="md" asChild className="w-full">
                <Link href="/onboarding/identity">← Back</Link>
              </Button>
            </div>
          }
        />
      }
    />
  );
}
