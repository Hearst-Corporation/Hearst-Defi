"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { toast } from "sonner";

import { CockpitButton as Button } from "@/components/catalyst/cockpit-button";
import { ConfirmDialog } from "@/components/catalyst/confirm-dialog";
import { unbindWallet } from "@/lib/onboarding/actions";

/**
 * Profile control to disconnect / change the bound wallet.
 *
 * Guarded by a confirmation dialog: this wallet is the delivery address for
 * the BTC accumulated by the note at maturity, so an accidental unbind would
 * require reconnecting a wallet before delivery can be routed there. Only
 * after the user confirms do we run the two-step disconnect:
 *   1. Privy `logout()` — drops the wallet session in the browser (so the
 *      connected / Privy-embedded wallet does not silently re-bind).
 *   2. `unbindWallet()` — clears Investor.walletAddress in the DB.
 * Then refresh so the Profile row falls back to the "Connect wallet" state and
 * a different wallet can be linked.
 */
export function WalletDisconnectButton() {
  const router = useRouter();
  const { ready, authenticated, logout } = usePrivy();
  const [open, setOpen] = useState(false);

  async function onConfirmDisconnect() {
    if (ready && authenticated) {
      try {
        await logout();
      } catch {
        // best-effort: still clear the DB binding below
      }
    }
    await unbindWallet();
    toast.success("Wallet disconnected");
    router.refresh();
  }

  return (
    <>
      <Button
        type="button"
        variant="danger"
        size="md"
        onClick={() => setOpen(true)}
      >
        Disconnect / change wallet
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Disconnect wallet?"
        description={
          <>
            This wallet is the delivery address for the BTC accumulated by
            the note at maturity. Disconnecting it clears the link to your
            account — you will need to reconnect a wallet before delivery
            can be routed there.
          </>
        }
        confirmLabel="Disconnect wallet"
        confirmVariant="danger"
        onConfirm={onConfirmDisconnect}
      />
    </>
  );
}
