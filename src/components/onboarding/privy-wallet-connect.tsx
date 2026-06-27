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
        "rounded-2xl border border-white/10 bg-black shadow-sm overflow-hidden p-6",
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
        <div className="flex items-center justify-center gap-2 py-4 text-[12px] text-zinc-500">
          <span
            aria-hidden="true"
            className="size-1.5 rounded-full bg-[#A7FB90] animate-pulse"
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
        <span className="inline-flex items-center gap-2 rounded-full border border-[#A7FB90]/30 bg-[#A7FB90]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-[#A7FB90]">
          <span
            aria-hidden="true"
            className="size-1.5 rounded-full bg-[#A7FB90]"
          />
          Wallet linked
        </span>

        <p className="m-0 rounded-lg border border-white/5 bg-[#15191C] px-4 py-2.5 font-mono text-[13px] tabular-nums text-white">
          {abbreviateAddress(address)}
        </p>

        <p className="m-0 max-w-prose text-pretty text-[12px] leading-relaxed text-zinc-500">
          This wallet will receive your monthly USDC distributions and act as
          the signing key for on-chain position management.
        </p>
      </WalletSurface>
    );
  }

  return (
    <WalletSurface surface={surface} className={shellClass}>
      <p className="m-0 max-w-prose text-pretty text-[13px] leading-relaxed text-zinc-400">
        Link the wallet address that will receive your USDC distributions.
        Compatible with major wallets including MetaMask, Ledger, and Coinbase Wallet.
      </p>

      <button
        type="button"
        className="w-full rounded-lg bg-[#A7FB90] px-4 py-2.5 text-[13px] font-bold text-zinc-900 transition-colors hover:bg-[#A7FB90]/90"
        onClick={() => {
          setError(null);
          void connectWallet();
        }}
      >
        Connect wallet
      </button>

      {error ? (
        <p
          role="alert"
          className="m-0 max-w-prose text-pretty text-[12px] leading-relaxed text-red-400"
        >
          {error}
        </p>
      ) : null}

      <p className="m-0 max-w-prose text-pretty text-[12px] leading-relaxed text-zinc-500">
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
        className="rounded-2xl border border-white/10 bg-black p-6 text-center shadow-sm"
      >
        <p className="m-0 text-[13px] font-medium text-white">
          Wallet connection is not yet available for your account
        </p>
        <p className="m-0 mt-1.5 text-[12px] leading-relaxed text-zinc-500">
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
            <p className="m-0 text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500">
              Onboarding · Step 3 of 3
            </p>
            <h1 className="m-0 text-[24px] font-medium leading-tight tracking-tight text-white">
              Connect your wallet
            </h1>
            <p className="m-0 max-w-prose text-pretty text-[13px] leading-relaxed text-zinc-400">
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
              <Link
                href="/profile"
                className="font-medium text-[#A7FB90] hover:underline"
              >
                Profile
              </Link>{" "}
              settings. Hearst Connect does not custody funds between deposit
              and vault allocation.
            </>
          }
          actions={
            <div className="flex flex-col gap-3">
              <p className="m-0 text-pretty text-center text-[13px] leading-relaxed text-zinc-500">
                Wallet binding is optional during onboarding. Connect above now
                or link one later from{" "}
                <Link
                  href="/profile"
                  className="font-medium text-[#A7FB90] hover:underline"
                >
                  Profile
                </Link>
                .
              </p>
              <Link
                href="/portfolio"
                className="w-full rounded-lg bg-[#A7FB90] px-4 py-2.5 text-center text-[13px] font-bold text-zinc-900 transition-colors hover:bg-[#A7FB90]/90"
              >
                {walletBound ? "Continue to portfolio" : "Continue without wallet"}
              </Link>
              <Link
                href="/onboarding/identity"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-center text-[13px] font-medium text-white transition-colors hover:bg-white/10"
              >
                ← Back
              </Link>
            </div>
          }
        />
      }
    />
  );
}
