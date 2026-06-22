"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";

import { Button } from "@/components/ui/button";
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
    <Button
      variant="secondary"
      size="md"
      onClick={onDisconnect}
      disabled={isPending}
    >
      {isPending ? "Disconnecting…" : "Disconnect / change wallet"}
    </Button>
  );
}
