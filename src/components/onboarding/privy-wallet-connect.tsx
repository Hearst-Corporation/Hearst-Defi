"use client";

/**
 * Privy wallet connect — persists Investor.walletAddress via bindWallet.
 *
 * Pure Tailwind bento — matches the Portfolio page / vault term sheet. No DS
 * surface/badge/button components: native markup carries the behavioral props
 * (onClick, disabled, role, aria-*) directly. All Privy logic is untouched.
 */

import { usePrivy, useConnectWallet, useWallets } from "@privy-io/react-auth";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  OnboardingChamber,
  OnboardingChamberSole,
  useOnboardingShell,
} from "@/components/onboarding/onboarding-chamber";
import { StepProgressBar } from "@/components/onboarding/StepProgressBar";
import { CockpitButton as Button } from "@/components/catalyst/cockpit-button";
import { abbreviateAddress } from "@/lib/onchain";
import { bindWallet } from "@/lib/onboarding/actions";
import { cn } from "@/lib/cn";

interface PrivyWalletConnectProps {
  appId: string;
  boundAddress?: string | null;
  surface?: "card" | "bare";
}

function WalletSurface({
  surface,
  className,
  ...props
}: {
  surface: "card" | "bare";
} & React.HTMLAttributes<HTMLDivElement>) {
  if (surface === "bare") {
    return <div className={className} {...props} />;
  }

  return (
    <div
      className={cn(
        "rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-sm overflow-hidden p-6",
        className,
      )}
      {...props}
    />
  );
}

function PrivyConnectInner({
  boundAddress,
  surface,
}: {
  boundAddress: string | null;
  surface: "card" | "bare";
}) {
  const router = useRouter();
  const { ready, authenticated } = usePrivy();
  const [error, setError] = useState<string | null>(null);
  const { connectWallet } = useConnectWallet({
    // Surface connection failures instead of swallowing them — otherwise the
    // button does nothing with no feedback (pop-up blocked, user rejected, no
    // wallet extension, wrong network, …).
    onError: (err) =>
      setError(
        typeof err === "string" && err
          ? err
          : "Wallet connection failed or was cancelled. Make sure your wallet is unlocked, on Base Sepolia, and the pop-up is not blocked — then try again.",
      ),
  });
  const { wallets } = useWallets();
  const persistRef = useRef<string | null>(boundAddress?.toLowerCase() ?? null);

  const connectedWallet = wallets[0];
  const address = connectedWallet?.address ?? boundAddress;
  const shellClass = "flex flex-col items-center gap-5 text-center";

  useEffect(() => {
    const next = connectedWallet?.address;
    if (!next) return;
    const normalized = next.toLowerCase();
    if (normalized === persistRef.current) return;

    persistRef.current = normalized;
    void bindWallet(next).then((result) => {
      if (!result.ok) {
        console.error("[PrivyWalletConnect] bindWallet failed:", result.error);
        setError(result.error ?? "Could not link this wallet. Please try again.");
        persistRef.current = null;
      } else {
        setError(null);
        // revalidatePath in bindWallet invalidates the server cache; refresh
        // triggers the RSC re-fetch so /profile reflects the new walletAddress.
        router.refresh();
      }
    });
  }, [connectedWallet?.address]);

  if (!ready) {
    return (
      <WalletSurface
        surface={surface}
        aria-busy="true"
        aria-label="Loading wallet connection"
      >
        <div className="body-xs flex items-center justify-center gap-2 py-4">
          <span
            aria-hidden="true"
            className="size-1.5 rounded-full bg-[var(--ct-accent)] animate-pulse"
          />
          Loading wallet connection…
        </div>
      </WalletSurface>
    );
  }

  if (authenticated && address) {
    return (
      <WalletSurface
        surface={surface}
        className={shellClass}
        role="region"
        aria-label="Wallet connected"
      >
        <span className="ct-bento-label inline-flex items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--ct-accent)_30%,transparent)] bg-[color-mix(in_srgb,var(--ct-accent)_10%,transparent)] px-3 py-1 ct-text-accent">
          <span
            aria-hidden="true"
            className="size-1.5 rounded-full bg-[var(--ct-accent)]"
          />
          Wallet linked
        </span>

        <p className="mono body-sm m-0 rounded-lg border border-[var(--ct-border-soft)] bg-surface-inset px-4 py-2.5 ct-text-strong">
          {abbreviateAddress(address)}
        </p>

        <p className="body-xs m-0 max-w-prose text-pretty">
          This wallet will receive your monthly USDC distributions and act as
          the signing key for on-chain position management.
        </p>
      </WalletSurface>
    );
  }

  return (
    <WalletSurface surface={surface} className={shellClass}>
      <p className="body-sm m-0 max-w-prose text-pretty">
        Link the wallet address that will receive your USDC distributions.
        Compatible with major wallets including MetaMask, Ledger, and Coinbase Wallet.
      </p>

      <Button
        type="button"
        variant="primary"
        size="lg"
        className="w-full"
        onClick={() => {
          setError(null);
          void connectWallet();
        }}
      >
        Connect wallet
      </Button>

      {error ? (
        <p
          role="alert"
          className="body-xs ct-status-danger m-0 max-w-prose text-pretty"
        >
          {error}
        </p>
      ) : null}

      <p className="body-xs m-0 max-w-prose text-pretty">
        Wallet binding is used solely for on-chain distribution delivery.
        No private keys are stored or transmitted.
      </p>
    </WalletSurface>
  );
}

export function PrivyWalletConnect({
  appId,
  boundAddress = null,
  surface = "card",
}: PrivyWalletConnectProps) {
  if (!appId) {
    return (
      <div
        role="note"
        className="rounded-2xl border border-[var(--ct-border)] bg-surface-card p-6 text-center shadow-sm"
      >
        <p className="body-sm ct-text-strong m-0 font-medium">
          Wallet connection is not yet available for your account
        </p>
        <p className="body-xs m-0 mt-1.5">
          You can continue onboarding now and link a wallet later from Profile
          once it becomes available.
        </p>
      </div>
    );
  }

  return <PrivyConnectInner boundAddress={boundAddress} surface={surface} />;
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
  const { irContact } = useOnboardingShell();

  return (
    <OnboardingChamber
      testId="onboarding-wallet"
      crown={
        <>
          <StepProgressBar active="wallet" />
          <div className="flex flex-col gap-2">
            <p className="ct-bento-label m-0">Onboarding · Step 3 of 3</p>
            <h1 className="h1 m-0">Connect your wallet</h1>
            <p className="body-sm m-0 max-w-prose text-pretty">
              Link the wallet address that will receive your USDC distributions.
              This wallet will also be the signing key for on-chain position
              management.
            </p>
          </div>
        </>
      }
      body={
        <PrivyWalletConnect appId={appId} boundAddress={boundAddress} />
      }
      sole={
        <OnboardingChamberSole
          irContact={irContact}
          compliance={
            <>
              You can update your distribution wallet after onboarding via your{" "}
              <Link href="/profile" className="ct-link-accent">
                Profile
              </Link>{" "}
              settings. Hearst Connect does not custody funds between deposit
              and vault allocation.
            </>
          }
          actions={
            <div className="flex flex-col gap-3">
              <p className="body-sm m-0 text-pretty text-center">
                Wallet binding is optional during onboarding. Connect above now
                or link one later from{" "}
                <Link href="/profile" className="ct-link-accent">
                  Profile
                </Link>
                .
              </p>
              <Button variant="primary" size="lg" asChild className="w-full">
                <Link href="/portfolio">
                  {walletBound
                    ? "Continue to portfolio"
                    : "Continue without wallet"}
                </Link>
              </Button>
              <Button variant="secondary" size="lg" asChild className="w-full">
                <Link href="/onboarding/identity">← Back</Link>
              </Button>
            </div>
          }
        />
      }
    />
  );
}
