"use client";

/**
 * PrivyWalletConnect — real Privy embedded wallet connect for the onboarding
 * wallet-binding step.
 *
 * Gated: only renders the live Privy flow when `appId` is truthy (i.e.
 * `NEXT_PUBLIC_PRIVY_APP_ID` is set). When absent it renders the
 * `WalletConnectPlaceholder` "Configuration en attente" state so the page
 * never breaks in local dev or CI.
 *
 * Cockpit tokens only. No new DS tokens.
 */

import { usePrivy, useConnectWallet, useWallets } from "@privy-io/react-auth";

import { cn } from "@/lib/cn";

interface PrivyWalletConnectProps {
  /** Pass `process.env.NEXT_PUBLIC_PRIVY_APP_ID` from the Server Component. */
  appId: string;
}

/**
 * Inner component — only mounted when Privy is configured (appId truthy).
 * Uses Privy hooks safely within the PrivyProvider context.
 */
function PrivyConnectInner() {
  const { ready, authenticated } = usePrivy();
  const { connectWallet } = useConnectWallet();
  const { wallets } = useWallets();

  const connectedWallet = wallets[0];
  const address = connectedWallet?.address ?? null;
  const displayAddress = address
    ? `${address.slice(0, 6)}…${address.slice(-4)}`
    : null;

  // Not yet ready — show a brief skeleton to avoid flash
  if (!ready) {
    return (
      <div
        className="w-full rounded-lg border border-[var(--ct-border-soft)] ct-surface-1 px-[var(--ct-space-6)] py-[var(--ct-space-8)] flex items-center justify-center"
        aria-busy="true"
        aria-label="Loading wallet connection"
      >
        <span className="body-sm ct-text-faint animate-pulse">
          Loading wallet connection…
        </span>
      </div>
    );
  }

  // Wallet already connected
  if (authenticated && displayAddress) {
    return (
      <div
        className="w-full rounded-lg border border-[var(--ct-border-soft)] ct-surface-1 px-[var(--ct-space-6)] py-[var(--ct-space-8)] flex flex-col items-center gap-[var(--ct-space-4)] text-center"
        role="region"
        aria-label="Wallet connected"
      >
        {/* Status dot */}
        <span
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[var(--ct-status-success-border)] ct-status-success-bg ct-status-success text-[length:var(--ct-text-micro)] font-medium uppercase tracking-[var(--ct-tracking-wide)]"
        >
          <span
            aria-hidden="true"
            className="inline-block w-1.5 h-1.5 rounded-full bg-current"
          />
          Wallet Connected
        </span>

        <p
          className={cn(
            "font-mono text-sm ct-text-strong",
            "rounded-md ct-surface-2",
            "px-4 py-2 tabular-nums tracking-widest",
          )}
        >
          {displayAddress}
        </p>

        <p className="body-xs ct-text-faint text-pretty">
          This wallet will receive your monthly USDC distributions and act as
          the signing key for on-chain position management.
        </p>
      </div>
    );
  }

  // Prompt to connect
  return (
    <div
      className="w-full rounded-lg border border-dashed border-[var(--ct-border-soft)] ct-surface-1 px-[var(--ct-space-8)] py-[var(--ct-space-8)] flex flex-col items-center gap-[var(--ct-space-4)] text-center"
      role="region"
      aria-label="Connect wallet"
    >
      <div className="flex flex-col gap-[var(--ct-space-2)]">
        <h3 className="h3">
          Connect Your Wallet
        </h3>
        <p className="body-sm ct-text-muted ct-prose-narrow">
          Link the wallet address that will receive your USDC distributions.
          Supported: MetaMask, Ledger, WalletConnect, Coinbase Wallet.
        </p>
      </div>

      <button
        type="button"
        onClick={() => void connectWallet()}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-md px-6 py-2.5",
          "text-sm font-semibold transition-opacity duration-[var(--ct-dur-fast)]",
          "bg-[var(--ct-accent)] text-[var(--ct-bg-deep)]",
          "hover:opacity-90 active:opacity-75",
        )}
      >
        Connect Wallet
      </button>

      <p className="body-xs ct-text-faint text-center text-pretty">
        Wallet binding is used solely for on-chain distribution delivery.
        No private keys are stored or transmitted.
      </p>
    </div>
  );
}

/**
 * ConfigPending — shown when NEXT_PUBLIC_PRIVY_APP_ID is not set.
 * Reuses the visual language of the existing `WalletConnectPlaceholder`
 * but signals "Configuration en attente" clearly.
 */
function ConfigPending() {
  return (
    <div
      className="w-full rounded-lg border border-dashed border-[var(--ct-border-soft)] ct-surface-1 p-[var(--ct-space-8)] flex flex-col items-center gap-[var(--ct-space-4)] text-center"
      role="region"
      aria-label="Wallet connection — configuration pending"
    >
      <div className="flex flex-col gap-[var(--ct-space-2)]">
        <h3 className="h3">
          Connect Your Wallet
        </h3>
        <p className="body-sm ct-text-muted ct-prose-narrow">
          Link your institutional wallet to receive USDC distributions and manage
          your vault position.
        </p>
      </div>

      <span
        className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[var(--ct-status-warning-border)] ct-status-warning-bg ct-status-warning text-[length:var(--ct-text-micro)] font-medium uppercase tracking-[var(--ct-tracking-wide)]"
      >
        <span
          aria-hidden="true"
          className="inline-block w-1.5 h-1.5 rounded-full bg-current"
        />
        Configuration en attente
      </span>

      <p className="body-xs ct-text-faint text-center text-pretty">
        Set{" "}
        <code className="font-mono ct-text-muted">
          NEXT_PUBLIC_PRIVY_APP_ID
        </code>{" "}
        to activate wallet binding.
      </p>
    </div>
  );
}

/**
 * PrivyWalletConnect — exported component used by `wallet/page.tsx`.
 *
 * When `appId` is empty the component returns `ConfigPending` — the page stays
 * fully renderable and the build does not crash.
 */
export function PrivyWalletConnect({ appId }: PrivyWalletConnectProps) {
  if (!appId) return <ConfigPending />;
  return <PrivyConnectInner />;
}
