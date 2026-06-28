"use client";

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
    <div className="flex items-center gap-3 py-3 border-b border-white/5 last:border-b-0">
      <span
        aria-hidden
        className={cn(
          "size-2.5 shrink-0 rounded-full border-2 border-[#15191C]",
          status === "ok" && "bg-[#A7FB90]",
          status === "action" && "bg-[#A7FB90]/40",
          status === "pending" && "bg-white/20",
        )}
      />
      <div className="flex flex-col gap-0.5 min-w-0 flex-auto">
        <span className="text-[13px] font-medium text-zinc-200">{label}</span>
        <span className="text-[12px] text-zinc-500 tracking-wide truncate">
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

  const epochIndicative: { status: EpochStatus; endsInDays: number } = {
    status: "ACTIVE",
    endsInDays: 18,
  };

  const walletOk = resolvedAddress !== null;
  const allowanceOk = allowanceApproved;
  const epochOk = epochIndicative.status === "ACTIVE";
  const checksComplete = [walletOk, networkOk, allowanceOk, epochOk].filter(Boolean).length;

  const panelBody = !ready ? (
    <p className="text-[12px] text-zinc-500 animate-pulse py-4 text-center">
      Loading wallet…
    </p>
  ) : !vaultConfigured ? (
    <div className="flex flex-col gap-2 py-2">
      <span className="self-start text-[10px] font-bold uppercase tracking-[0.15em] text-[#A7FB90] bg-[#A7FB90]/10 border border-[#A7FB90]/20 rounded-full px-2.5 py-1">
        Configuration pending
      </span>
      <p className="text-[12px] text-zinc-500 tracking-wide">
        On-chain configuration is being finalized. Please contact Investor
        Relations.
      </p>
    </div>
  ) : (
    <>
      <div className="flex items-center justify-between pb-3 mb-1 border-b border-white/5">
        <span className="text-[10px] uppercase tracking-[0.15em] font-bold text-zinc-500">
          Readiness
        </span>
        <span className="text-[12px] text-zinc-400">
          <span className="font-semibold text-white tabular-nums font-mono">
            {checksComplete}
          </span>
          {" "}of 4 complete
        </span>
      </div>

      {vaultStale ? (
        <div className="flex flex-col gap-2 mb-3 rounded-xl border border-[#A7FB90]/20 bg-surface-inset p-3">
          <span className="self-start text-[10px] font-bold uppercase tracking-[0.15em] text-[#A7FB90] bg-[#A7FB90]/10 border border-[#A7FB90]/20 rounded-full px-2.5 py-1">
            Testnet contract
          </span>
          <p className="text-[12px] text-zinc-500 tracking-wide">
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
            <button
              type="button"
              onClick={() => void handleApprove()}
              disabled={approving || !networkOk}
              className={cn(
                "rounded-lg border border-[#A7FB90]/30 bg-[#A7FB90]/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-[#A7FB90] transition-colors hover:bg-[#A7FB90]/20",
                "disabled:cursor-not-allowed disabled:opacity-50",
                approving && "cursor-wait opacity-70",
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
        detail={`${epochStatusLabel[epochIndicative.status]} · closes in ${epochIndicative.endsInDays}d · indicative`}
      />
    </>
  );

  return (
    <div className="rounded-2xl border border-white/10 bg-surface-card shadow-sm overflow-hidden flex flex-col">
      <div className="flex flex-col gap-1.5 p-5 border-b border-white/5">
        <h2 className="text-[11px] font-bold text-zinc-400 uppercase tracking-[0.15em] leading-none">
          Pre-flight check
        </h2>
        <p className="text-[10px] text-zinc-500 uppercase tracking-[0.15em] font-bold">
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
