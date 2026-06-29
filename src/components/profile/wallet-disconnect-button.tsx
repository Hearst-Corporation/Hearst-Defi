"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";

import { unbindWallet } from "@/lib/onboarding/actions";

/**
 * Profile control to disconnect / change the bound distribution wallet.
 *
 * Two steps so the connected (or Privy-embedded) wallet does not silently
 * re-bind:
 *   1. Privy `logout()` — drops the wallet session in the browser.
 *   2. `unbindWallet()` — clears Investor.walletAddress in the DB.
 * Then refresh so the Profile row falls back to the "Connect wallet" state and
 * a different wallet can be linked.
 */
export function WalletDisconnectButton() {
  const router = useRouter();
  const { ready, authenticated, logout } = usePrivy();
  const [isPending, startTransition] = useTransition();

  function onDisconnect() {
    startTransition(async () => {
      if (ready && authenticated) {
        try {
          await logout();
        } catch {
          // best-effort: still clear the DB binding below
        }
      }
      await unbindWallet();
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={onDisconnect}
      disabled={isPending}
      className="inline-flex items-center justify-center rounded-lg border border-[var(--ct-status-danger-border)] bg-[color-mix(in_srgb,var(--ct-text-strong)_5%,transparent)] px-4 py-2.5 text-[length:var(--ct-text-xs)] font-bold text-[var(--ct-status-danger)] transition-colors hover:bg-[color-mix(in_srgb,var(--ct-text-strong)_10%,transparent)] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {isPending ? "Disconnecting…" : "Disconnect / change wallet"}
    </button>
  );
}
