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
      router.push(
        `${investConfirmedPath(vaultId)}?amount=${amountUsdc}&positionId=${result.positionId}&demo=1`,
      );
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-dashed border-[var(--ct-border)] bg-surface-inset p-4">
      <span className="ct-bento-label">Demo shortcut</span>
      <p className="body-xs ct-text-faint m-0">
        Subscribe without an on-chain deposit — no wallet or testnet USDC needed.
      </p>
      <div>
        <Button
          type="button"
          variant="secondary"
          size="md"
          onClick={onSimulate}
          disabled={isPending || done || !(amountUsdc > 0)}
          aria-busy={isPending}
        >
          {isPending || done ? "Simulating…" : "Simulate deposit"}
        </Button>
      </div>
      {error ? (
        <p className="body-xs ct-status-danger m-0" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
