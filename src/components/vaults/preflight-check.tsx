"use client";

import { usePrivy, useWallets } from "@privy-io/react-auth";
import type { ConnectedWallet } from "@privy-io/react-auth";

import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NestedPanel } from "@/components/ui/nested-panel";
import { VaultPanelHeader } from "@/components/vaults/vault-flow-primitives";
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
    <div className="product-doc-inline-row product-doc-inline-row--start product-doc-inline-row--loose py-2.5">
      <span
        aria-hidden
        className={cn(
          "mt-0.5 h-2 w-2 shrink-0 rounded-full",
          status === "ok" && "ct-status-dot-success",
          status === "action" && "ct-status-dot-warning",
          status === "pending" && "ct-status-dot-info",
        )}
      />
      <div className="pf-inline-row pf-inline-row--between min-w-0 flex-1">
        <div className="min-w-0">
          <span className="body-sm font-semibold ct-text-primary">{label}</span>
          <span className="body-xs ct-text-muted ml-2">{detail}</span>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
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
    walletChainId === null ? true : walletChainId === BASE_SEPOLIA_CHAIN_ID;
  const networkDetail =
    walletChainId === null
      ? "Base Sepolia"
      : networkOk
        ? "Base Sepolia"
        : `Chain ${walletChainId} — switch to Base Sepolia`;

  const vaultConfigured = VAULT_ADDRESS !== null;
  const vaultStale = isVaultStale();

  async function handleApprove() {
    if (!privyWallet) {
      onApproveError?.("No wallet connected. Connect a wallet first.");
      return;
    }

    if (!vaultConfigured) {
      onApproveError?.("Vault address not configured. Contact support.");
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

  const epochIndicative: { status: EpochStatus; endsInDays: number } = {
    status: "ACTIVE",
    endsInDays: 18,
  };

  const walletOk = resolvedAddress !== null;
  const allowanceOk = allowanceApproved;
  const epochOk = epochIndicative.status === "ACTIVE";

  const panelBody = !ready ? (
    <p className="body-xs ct-text-muted animate-pulse py-4 text-center">
      Loading wallet…
    </p>
  ) : !vaultConfigured ? (
    <div className="product-doc-stack--tight py-4">
      <Badge variant="warning" className="self-start">
        Configuration pending
      </Badge>
      <p className="body-xs ct-text-muted">
        Set{" "}
        <code className="mono">NEXT_PUBLIC_HEARST_VAULT_ADDRESS</code> to
        activate on-chain transactions.
      </p>
    </div>
  ) : (
    <>
      {vaultStale ? (
        <div className="product-doc-stack--dense py-3">
          <Badge variant="warning" className="self-start">
            Testnet contract
          </Badge>
          <p className="body-xs ct-text-muted">
            This vault is a testnet build with no emergency pause or guardian
            and a $1,000 minimum — not the audited production contract.
          </p>
        </div>
      ) : null}

      <CheckRow
        label="Wallet"
        status={walletOk ? "ok" : "action"}
        detail={
          walletOk
            ? abbreviateAddress(resolvedAddress!)
            : "Connect a wallet to continue"
        }
      />

      <CheckRow
        label="Network"
        status={networkOk ? "ok" : "action"}
        detail={networkDetail}
      />

      <CheckRow
        label="Allowance"
        status={allowanceOk ? "ok" : "action"}
        detail={
          allowanceOk
            ? "USDC approved"
            : amount > 0
              ? `Approve ${formatUsdAmount(amount)} USDC`
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
              className="border ct-bc-accent ct-text-accent hover:ct-surface-1"
            >
              {approving ? "Approving…" : "Approve"}
            </Button>
          ) : undefined
        }
      />

      <CheckRow
        label="Epoch"
        status={epochOk ? "ok" : "pending"}
        detail={`${epochStatusLabel[epochIndicative.status]} · closes in ${epochIndicative.endsInDays}d · indicative`}
      />
    </>
  );

  return (
    <NestedPanel className="ct-divide-soft py-0">
      <VaultPanelHeader title="Pre-flight check" />
      <div className="vault-panel-body">{panelBody}</div>
    </NestedPanel>
  );
}

export function isPreFlightReady(
  walletAddress: string | null,
  allowanceApproved: boolean,
  epoch: { status: EpochStatus },
): boolean {
  return walletAddress !== null && allowanceApproved && epoch.status === "ACTIVE";
}
