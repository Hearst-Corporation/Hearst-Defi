"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";

import { CockpitButton as Button } from "@/components/catalyst/cockpit-button";
import { simulateDeposit } from "@/lib/demo/actions";
import { investConfirmedPath } from "@/lib/vaults/invest-routes";

interface DemoDepositSimulateProps {
  vaultId: string;
  amountUsdc: number;
  shareClass: string;
}

/**
 * Demo-only shortcut in the invest flow: subscribe WITHOUT a real on-chain
 * deposit (no wallet, no Base Sepolia tx, no USDC). Rendered ONLY for demo
 * accounts; the server action is allowlist-gated and still enforces KYC /
 * accreditation / capacity / min-ticket — only the on-chain settlement step is
 * simulated.
 */
export function DemoDepositSimulate({
  vaultId,
  amountUsdc,
  shareClass,
}: DemoDepositSimulateProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Latched once a simulate succeeds: the off-chain position has no unique tx
  // hash, so a second click would create a duplicate. Stays true through the
  // navigation so the button can't fire twice.
  const [done, setDone] = useState(false);

  function onSimulate() {
    if (isPending || done) return;
    setError(null);
    startTransition(async () => {
      const result = await simulateDeposit(vaultId, amountUsdc, shareClass);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDone(true);
      // Through the standard invest confirmation screen (same as a real
      // subscription), carrying the amount + new positionId, flagged demo=1.
      router.push(
        `${investConfirmedPath(vaultId)}?amount=${amountUsdc}&positionId=${result.positionId}&demo=1`,
      );
    });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <Button
        type="button"
        variant="primary"
        size="md"
        onClick={onSimulate}
        disabled={isPending || done || !(amountUsdc > 0)}
        aria-busy={isPending}
      >
        {isPending || done ? "Depositing…" : "Deposit"}
      </Button>
      {error ? (
        <p className="body-xs ct-status-danger m-0" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
