"use client";

// PreFlightCheck — 4 checks: Wallet · Network · Allowance · Epoch
// Approve is a REAL ERC-20 tx via viem + Privy wallet.
// Epoch remains indicative (no on-chain epoch registry yet) — badged clearly.
// Non-negotiable #5: no forbidden words in copy.

import { usePrivy, useWallets } from "@privy-io/react-auth";
import type { ConnectedWallet } from "@privy-io/react-auth";

import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  approveUsdc,
  walletClientFromProvider,
  VAULT_ADDRESS,
  ConfigError,
  ChainError,
} from "@/lib/onchain/vault";
import { abbreviateAddress } from "@/lib/onchain";
import type { EpochStatus } from "@/lib/onchain";

const BASE_SEPOLIA_CHAIN_ID = 84532;

interface CheckRowProps {
  label: string;
  status: "ok" | "pending" | "action";
  detail: string;
  action?: React.ReactNode;
}

function CheckRow({ label, status, detail, action }: CheckRowProps) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      {/* Status dot */}
      <span
        aria-hidden
        className={cn(
          "mt-0.5 h-2 w-2 rounded-full shrink-0",
          status === "ok" && "ct-status-dot-success",
          status === "action" && "ct-status-dot-warning",
          status === "pending" && "ct-status-dot-info",
        )}
      />
      <div className="flex flex-1 items-center justify-between gap-2 min-w-0">
        <div className="min-w-0">
          <span className="body-sm font-semibold ct-text-primary">{label}</span>
          <span className="body-xs ct-text-muted ml-2">{detail}</span>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  );
}

interface PreFlightCheckProps {
  walletAddress: string | null;
  amount: number;
  vaultId: string;
  onAllowanceApproved: () => void;
  allowanceApproved: boolean;
  approving: boolean;
  onApproveStart: () => void;
  onApproveEnd: () => void;
  onApproveError?: (msg: string) => void;
}

export function PreFlightCheck({
  walletAddress,
  amount,
  vaultId: _vaultId,
  onAllowanceApproved,
  allowanceApproved,
  approving,
  onApproveStart,
  onApproveEnd,
  onApproveError,
}: PreFlightCheckProps) {
  const { ready } = usePrivy();
  const { wallets } = useWallets();

  // Resolve the live Privy wallet (first connected wallet).
  const privyWallet: ConnectedWallet | undefined = wallets[0];
  const liveAddress = privyWallet?.address ?? null;

  // Use liveAddress if available, fall back to prop (parent may pass stub in dev).
  const resolvedAddress = liveAddress ?? walletAddress;

  // Network check — detect wallet chain vs Base Sepolia.
  const walletChainId: number | null = (() => {
    if (!privyWallet) return null;
    // Privy exposes `chainId` as a string like "eip155:84532"
    const raw = (privyWallet as unknown as { chainId?: string }).chainId;
    if (!raw) return null;
    const parts = raw.split(":");
    const id = parseInt(parts[parts.length - 1] ?? "", 10);
    return isNaN(id) ? null : id;
  })();

  const networkOk =
    walletChainId === null ? true : walletChainId === BASE_SEPOLIA_CHAIN_ID;
  const networkDetail =
    walletChainId === null
      ? "Base Sepolia"
      : networkOk
        ? "Base Sepolia"
        : `Chain ${walletChainId} — switch to Base Sepolia`;

  // Vault address configured?
  const vaultConfigured = VAULT_ADDRESS !== null;

  async function handleApprove() {
    if (!privyWallet) {
      onApproveError?.("No wallet connected. Connect a wallet first.");
      return;
    }

    if (!vaultConfigured) {
      onApproveError?.(
        "Vault address not configured. Contact support.",
      );
      return;
    }

    onApproveStart();
    try {
      const provider = await privyWallet.getEthereumProvider();
      const wc = walletClientFromProvider(
        provider,
        privyWallet.address as `0x${string}`,
      );
      await approveUsdc({ walletClient: wc, amountUsdc: amount });
      onAllowanceApproved();
    } catch (e) {
      let msg = "Approval failed. Please try again.";
      if (e instanceof ConfigError || e instanceof ChainError) {
        msg = e.message;
      } else if (e instanceof Error) {
        msg = e.message;
      }
      onApproveError?.(msg);
    } finally {
      onApproveEnd();
    }
  }

  const epochStatusLabel: Record<EpochStatus, string> = {
    ACTIVE: "Active",
    ENDING: "Ending soon",
    SYNC: "Sync in progress",
  };

  // Epoch is indicative — no on-chain epoch registry in V1.
  const epochIndicative: { status: EpochStatus; endsInDays: number } = {
    status: "ACTIVE",
    endsInDays: 18,
  };

  const walletOk = resolvedAddress !== null;
  const allowanceOk = allowanceApproved;
  const epochOk = epochIndicative.status === "ACTIVE";

  // If Privy is not yet ready, show a loading state.
  if (!ready) {
    return (
      <Card className="divide-y divide-[var(--ct-border-soft)]">
        <p className="eyebrow py-3">Pre-flight check</p>
        <p className="body-xs ct-text-muted py-4 text-center animate-pulse">
          Loading wallet…
        </p>
      </Card>
    );
  }

  // If vault address is not configured, surface a clear "configuration pending" state
  // rather than letting the user attempt a transaction.
  if (!vaultConfigured) {
    return (
      <Card className="divide-y divide-[var(--ct-border-soft)]">
        <p className="eyebrow py-3">Pre-flight check</p>
        <div className="py-4 px-1 flex flex-col gap-2">
          <span
            className="inline-flex items-center gap-2 px-3 py-1 self-start rounded-full border border-[var(--ct-status-warning-border)] ct-status-warning-bg ct-status-warning text-[length:var(--ct-text-micro)] font-medium uppercase tracking-[var(--ct-tracking-wide)]"
          >
            <span
              aria-hidden="true"
              className="inline-block w-1.5 h-1.5 rounded-full bg-current"
            />
            Configuration en attente
          </span>
          <p className="body-xs ct-text-muted">
            Set{" "}
            <code className="font-mono">NEXT_PUBLIC_HEARST_VAULT_ADDRESS</code>{" "}
            to activate on-chain transactions.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="divide-y divide-[var(--ct-border-soft)]">
      <p className="eyebrow py-3">Pre-flight check</p>

      {/* 1 — Wallet */}
      <CheckRow
        label="Wallet"
        status={walletOk ? "ok" : "action"}
        detail={
          walletOk
            ? abbreviateAddress(resolvedAddress!)
            : "Connect a wallet to continue"
        }
      />

      {/* 2 — Network */}
      <CheckRow
        label="Network"
        status={networkOk ? "ok" : "action"}
        detail={networkDetail}
      />

      {/* 3 — Allowance */}
      <CheckRow
        label="Allowance"
        status={allowanceOk ? "ok" : "action"}
        detail={
          allowanceOk
            ? "USDC approved"
            : amount > 0
              ? `Approve $${amount.toLocaleString("en-US")} USDC`
              : "Enter amount first"
        }
        action={
          !allowanceOk && amount > 0 && walletOk ? (
            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={() => void handleApprove()}
              disabled={approving || !networkOk}
              className="border border-[var(--ct-border-accent)] ct-text-accent hover:bg-[var(--ct-accent-soft)]"
            >
              {approving ? "Approving…" : "Approve"}
            </Button>
          ) : undefined
        }
      />

      {/* 4 — Epoch (indicative — no on-chain epoch registry in V1) */}
      <CheckRow
        label="Epoch"
        status={epochOk ? "ok" : "pending"}
        detail={`${epochStatusLabel[epochIndicative.status]} · closes in ${epochIndicative.endsInDays}d · indicative`}
      />
    </Card>
  );
}

// Exported helper — tells parent if pre-flight is complete.
// Epoch is not gating (indicative only), only wallet + allowance gate the CTA.
export function isPreFlightReady(
  walletAddress: string | null,
  allowanceApproved: boolean,
  epoch: { status: EpochStatus },
): boolean {
  // epoch.status check retained to honour the existing contract from parent callers
  return walletAddress !== null && allowanceApproved && epoch.status === "ACTIVE";
}
