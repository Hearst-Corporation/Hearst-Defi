"use client";

import { useState } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import type { ConnectedWallet } from "@privy-io/react-auth";

import { cn } from "@/lib/cn";
import { formatUsdAmount } from "@/lib/vaults/product-display";
import {
  approveUsdc,
  walletClientFromProvider,
  VAULT_ADDRESS,
  ConfigError,
  ChainError,
  isVaultStale,
} from "@/lib/onchain/vault";
import { abbreviateAddress } from "@/lib/onchain";
import type { EpochStatus } from "@/lib/onchain";

const BASE_SEPOLIA_CHAIN_ID = 84532;

function CheckRow({
  label,
  status,
  detail,
  action,
}: {
  label: string;
  status: "ok" | "pending" | "action";
  detail: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-[var(--ct-border-soft)] last:border-b-0">
      <span
        aria-hidden
        className={cn(
          "size-2.5 shrink-0 rounded-full border-2 border-[var(--ct-surface-inset)]",
          status === "ok" && "bg-[var(--ct-accent)]",
          status === "action" && "bg-[color-mix(in_srgb,var(--ct-accent)_40%,transparent)]",
          status === "pending" && "bg-[color-mix(in_srgb,var(--ct-text-strong)_16%,transparent)]",
        )}
      />
      <div className="flex flex-col gap-0.5 min-w-0 flex-auto">
        <span className="text-[length:var(--ct-text-xs)] font-medium text-[var(--ct-text-strong)]">{label}</span>
        <span className="text-[length:var(--ct-text-2xs)] text-[var(--ct-text-faint)] tracking-wide truncate">
          {detail}
        </span>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

interface PreFlightCheckProps {
  walletAddress: string | null;
  amount: number;
  onAllowanceApproved: () => void;
  allowanceApproved: boolean;
  approving: boolean;
  onApproveStart: () => void;
  onApproveEnd: () => void;
  onApproveError?: (msg: string) => void;
  /**
   * Demo accounts subscribe off-chain (no wallet / chain / USDC allowance), so
   * the on-chain readiness rows (Wallet, Network, Allowance) are shown satisfied
   * and their APPROVE / Switch actions are suppressed. Purely presentational —
   * the real deposit path is unchanged; the demo "Simulate deposit" action does
   * the settlement-free subscribe.
   */
  demoMode?: boolean;
}

export function PreFlightCheck({
  walletAddress,
  amount,
  onAllowanceApproved,
  allowanceApproved,
  approving,
  onApproveStart,
  onApproveEnd,
  onApproveError,
  demoMode = false,
}: PreFlightCheckProps) {
  const { ready } = usePrivy();
  const { wallets } = useWallets();
  const [switching, setSwitching] = useState(false);

  const privyWallet: ConnectedWallet | undefined = wallets[0];
  const liveAddress = privyWallet?.address ?? null;
  const resolvedAddress = liveAddress ?? walletAddress;

  const walletChainId: number | null = (() => {
    if (!privyWallet) return null;
    const raw = (privyWallet as unknown as { chainId?: string }).chainId;
    if (!raw) return null;
    const parts = raw.split(":");
    const id = parseInt(parts[parts.length - 1] ?? "", 10);
    return Number.isNaN(id) ? null : id;
  })();

  const networkOk =
    demoMode ||
    (walletChainId === null ? true : walletChainId === BASE_SEPOLIA_CHAIN_ID);
  const networkDetail = demoMode
    ? "Base Sepolia · simulated"
    : walletChainId === null
      ? "Base Sepolia"
      : networkOk
        ? "Base Sepolia"
        : `Chain ${walletChainId} — switch to Base Sepolia`;

  const vaultConfigured = VAULT_ADDRESS !== null;
  const vaultStale = isVaultStale();

  async function handleSwitchNetwork() {
    if (!privyWallet) {
      onApproveError?.("No wallet connected. Connect a wallet first.");
      return;
    }
    setSwitching(true);
    try {
      await privyWallet.switchChain(BASE_SEPOLIA_CHAIN_ID);
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : "Could not switch network. Switch to Base Sepolia in your wallet.";
      onApproveError?.(msg);
    } finally {
      setSwitching(false);
    }
  }

  async function handleApprove() {
    if (!privyWallet) {
      onApproveError?.("No wallet connected. Connect a wallet first.");
      return;
    }

    if (!vaultConfigured) {
      onApproveError?.("Deposit access is being configured. Please try again shortly.");
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

  // Epoch readiness is gated on status only. There is no real on-chain epoch
  // deadline feed yet, so we never render a fabricated countdown (audit I10) —
  // the row says "Active · indicative", not a made-up "closes in Nd".
  const epochIndicative: { status: EpochStatus } = {
    status: "ACTIVE",
  };

  const walletOk = demoMode || resolvedAddress !== null;
  const allowanceOk = demoMode || allowanceApproved;
  const epochOk = epochIndicative.status === "ACTIVE";
  const checksComplete = [walletOk, networkOk, allowanceOk, epochOk].filter(Boolean).length;

  const panelBody = !ready ? (
    <p className="text-[length:var(--ct-text-2xs)] text-[var(--ct-text-faint)] animate-pulse py-4 text-center">
      Loading wallet…
    </p>
  ) : !vaultConfigured ? (
    <div className="flex flex-col gap-2 py-2">
      <span className="self-start text-[length:var(--ct-text-deci)] font-bold uppercase tracking-[0.15em] text-[var(--ct-accent)] bg-[color-mix(in_srgb,var(--ct-accent)_10%,transparent)] border border-[color-mix(in_srgb,var(--ct-accent)_20%,transparent)] rounded-full px-2.5 py-1">
        Configuration pending
      </span>
      <p className="text-[length:var(--ct-text-2xs)] text-[var(--ct-text-faint)] tracking-wide">
        On-chain configuration is being finalized. Please contact Investor
        Relations.
      </p>
    </div>
  ) : (
    <>
      <div className="flex items-center justify-between pb-3 mb-1 border-b border-[var(--ct-border-soft)]">
        <span className="ct-bento-label">
          Readiness
        </span>
        <span className="text-[length:var(--ct-text-2xs)] text-[var(--ct-text-muted)]">
          <span className="font-semibold text-[var(--ct-text-strong)] tabular-nums font-mono">
            {checksComplete}
          </span>
          {" "}of 4 complete
        </span>
      </div>

      {vaultStale ? (
        <div className="flex flex-col gap-2 mb-3 rounded-xl border border-[color-mix(in_srgb,var(--ct-accent)_20%,transparent)] bg-surface-inset p-3">
          <span className="self-start text-[length:var(--ct-text-deci)] font-bold uppercase tracking-[0.15em] text-[var(--ct-accent)] bg-[color-mix(in_srgb,var(--ct-accent)_10%,transparent)] border border-[color-mix(in_srgb,var(--ct-accent)_20%,transparent)] rounded-full px-2.5 py-1">
            Testnet contract
          </span>
          <p className="text-[length:var(--ct-text-2xs)] text-[var(--ct-text-faint)] tracking-wide">
            This vault is a testnet build with no emergency pause or guardian
            and a $1,000 minimum — not the audited production contract.
          </p>
        </div>
      ) : null}

      <CheckRow
        label="Wallet"
        status={walletOk ? "ok" : "action"}
        detail={
          demoMode
            ? "Simulated — no wallet required"
            : walletOk
              ? abbreviateAddress(resolvedAddress!)
              : "Connect a wallet to continue"
        }
      />

      <CheckRow
        label="Network"
        status={networkOk ? "ok" : "action"}
        detail={networkDetail}
        action={
          !networkOk ? (
            <button
              type="button"
              onClick={() => void handleSwitchNetwork()}
              disabled={switching}
              className={cn(
                "rounded-lg border border-[color-mix(in_srgb,var(--ct-accent)_30%,transparent)] bg-[color-mix(in_srgb,var(--ct-accent)_10%,transparent)] px-3 py-1.5 text-[length:var(--ct-text-micro)] font-bold uppercase tracking-wider text-[var(--ct-accent)] transition-colors hover:bg-[color-mix(in_srgb,var(--ct-accent)_20%,transparent)]",
                "disabled:cursor-not-allowed disabled:opacity-[var(--ct-opacity-50)]",
                switching && "cursor-wait opacity-[var(--ct-opacity-70)]",
              )}
            >
              {switching ? (
                <span className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-current animate-ping" />
                  Switching…
                </span>
              ) : (
                "Switch"
              )}
            </button>
          ) : undefined
        }
      />

      <CheckRow
        label="Allowance"
        status={allowanceOk ? "ok" : "action"}
        detail={
          demoMode
            ? "Simulated — no approval needed"
            : allowanceOk
              ? "USDC approved"
              : amount > 0
                ? `Approve ${formatUsdAmount(amount)} USDC`
                : "Enter amount first"
        }
        action={
          !allowanceOk && amount > 0 && walletOk ? (
            <button
              type="button"
              onClick={() => void handleApprove()}
              disabled={approving || !networkOk}
              className={cn(
                "rounded-lg border border-[color-mix(in_srgb,var(--ct-accent)_30%,transparent)] bg-[color-mix(in_srgb,var(--ct-accent)_10%,transparent)] px-3 py-1.5 text-[length:var(--ct-text-micro)] font-bold uppercase tracking-wider text-[var(--ct-accent)] transition-colors hover:bg-[color-mix(in_srgb,var(--ct-accent)_20%,transparent)]",
                "disabled:cursor-not-allowed disabled:opacity-[var(--ct-opacity-50)]",
                approving && "cursor-wait opacity-[var(--ct-opacity-70)]",
              )}
            >
              {approving ? (
                <span className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-current animate-ping" />
                  Approving…
                </span>
              ) : (
                "Approve"
              )}
            </button>
          ) : undefined
        }
      />

      <CheckRow
        label="Epoch"
        status={epochOk ? "ok" : "pending"}
        detail={`${epochStatusLabel[epochIndicative.status]} · indicative`}
      />
    </>
  );

  return (
    <div className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-[var(--ct-shadow-soft)] overflow-hidden flex flex-col">
      <div className="flex flex-col gap-1.5 p-5 border-b border-[var(--ct-border-soft)]">
        <h2 className="text-[length:var(--ct-text-micro)] font-bold text-[var(--ct-text-muted)] uppercase tracking-[0.15em] leading-none">
          Pre-flight check
        </h2>
        <p className="ct-bento-label">
          Wallet · network · allowance · epoch
        </p>
      </div>
      <div className="p-5 flex flex-col">{panelBody}</div>
    </div>
  );
}

export function isPreFlightReady(
  walletAddress: string | null,
  allowanceApproved: boolean,
  epoch: { status: EpochStatus },
): boolean {
  return walletAddress !== null && allowanceApproved && epoch.status === "ACTIVE";
}
