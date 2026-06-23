"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { usePrivy, useWallets } from "@privy-io/react-auth";

import { Button } from "@/components/ui/button";
import { isPrivyConfigured } from "@/lib/auth/is-privy-configured";
import { formatUsdFull } from "@/lib/vaults/product-display";
import { Card } from "@/components/ui/card";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import {
  redeemFromVault,
  readMaxRedeem,
  walletClientFromProvider,
  VAULT_ADDRESS,
  ConfigError,
  ChainError,
  type RedeemFromVaultResult,
} from "@/lib/onchain/vault";
import { redeem } from "@/app/actions/redeem";
import { explorerTxUrlFromRegistry } from "@/lib/chain/deployments";
import type { PositionDetail } from "@/lib/data/portfolio";

interface PositionActionsProps {
  position: PositionDetail;
}

// "idle"      → initial; shows the "Withdraw" button (intent step, no calls).
// "confirm"   → review card shown; awaiting explicit "Confirm withdrawal".
// "redeeming" → on-chain redeem submitted, awaiting wallet/receipt.
// "recording" → on-chain done, persisting the off-chain DB record.
// "done"      → fully settled; shows tx + closed-position notice.
// "error"     → surfaced error; never silently swallowed.
type Phase =
  | "idle"
  | "confirm"
  | "redeeming"
  | "recording"
  | "done"
  | "error";

function shortHash(h: string): string {
  return h.length > 12 ? `${h.slice(0, 6)}…${h.slice(-4)}` : h;
}

function withdrawPrerequisiteError(
  ready: boolean,
  privyWallet: unknown,
  walletAddress: string | null,
): string | null {
  if (!VAULT_ADDRESS) return "Vault address not configured.";
  if (!ready || !privyWallet || walletAddress === null) {
    return "Connect your wallet to withdraw.";
  }
  return null;
}

function applyWithdrawPrerequisiteFailure(
  setError: (message: string | null) => void,
  setPhase: (phase: Phase) => void,
  ready: boolean,
  privyWallet: unknown,
  walletAddress: string | null,
): boolean {
  const prerequisiteError = withdrawPrerequisiteError(
    ready,
    privyWallet,
    walletAddress,
  );
  if (!prerequisiteError) return false;
  setError(prerequisiteError);
  setPhase("error");
  return true;
}

export function phaseAfterReviewClick(current: Phase): Phase {
  // From a resting state, open the review card. While a transaction is in
  // flight ("redeeming"/"recording") or finished ("done"), the intent button is
  // not shown, so the phase is unchanged.
  return current === "idle" || current === "error" ? "confirm" : current;
}

export function phaseAfterCancel(): Phase {
  return "idle";
}

export function canRunOnChainWithdraw(current: Phase): boolean {
  return current === "confirm";
}

export function PositionActions({ position }: PositionActionsProps) {
  if (position.status !== "active") return null;
  if (!isPrivyConfigured()) {
    return (
      <section aria-label="Position actions" className="product-doc-section">
        <p className="body-xs ct-text-muted">
          Self-served redemption connects your wallet to redeem vault shares on
          Base Sepolia. Wallet connection is being configured — contact Investor
          Relations to initiate a redemption in the meantime.
        </p>
      </section>
    );
  }
  return <PositionActionsLive position={position} />;
}

function PositionActionsLive({ position }: PositionActionsProps) {
  const router = useRouter();
  const { ready } = usePrivy();
  const { wallets } = useWallets();
  const privyWallet = wallets[0] ?? null;
  const walletAddress = privyWallet?.address ?? null;

  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RedeemFromVaultResult | null>(null);

  const handleReview = useCallback(() => {
    setError(null);
    if (
      applyWithdrawPrerequisiteFailure(
        setError,
        setPhase,
        ready,
        privyWallet,
        walletAddress,
      )
    ) {
      return;
    }
    setPhase((p) => phaseAfterReviewClick(p));
  }, [ready, privyWallet, walletAddress]);

  const handleCancel = useCallback(() => {
    setError(null);
    setPhase(phaseAfterCancel());
  }, []);

  const handleConfirmWithdraw = useCallback(async () => {
    if (!canRunOnChainWithdraw(phase)) return;

    setError(null);
    if (
      applyWithdrawPrerequisiteFailure(
        setError,
        setPhase,
        ready,
        privyWallet,
        walletAddress,
      )
    ) {
      return;
    }
    if (privyWallet === null || walletAddress === null) return;

    try {
      const owner = walletAddress as `0x${string}`;
      const shares = await readMaxRedeem(owner);
      if (shares === 0n) {
        setError("No redeemable vault shares for this wallet.");
        setPhase("error");
        return;
      }

      setPhase("redeeming");
      const provider = await privyWallet.getEthereumProvider();
      const wc = walletClientFromProvider(provider, owner);
      const res = await redeemFromVault({
        walletClient: wc,
        shares,
        receiver: owner,
        owner,
      });
      setResult(res);

      setPhase("recording");
      const assets = res.assetsUsdc > 0 ? res.assetsUsdc : position.principalUsdc;
      const recorded = await redeem(position.id, assets, res.txHash);
      if (!recorded.ok) {
        setError(`On-chain redemption succeeded but recording failed: ${recorded.error}`);
        setPhase("error");
        return;
      }

      setPhase("done");
      router.refresh();
    } catch (e) {
      if (e instanceof ConfigError || e instanceof ChainError) {
        setError(e.message);
      } else {
        setError(e instanceof Error ? e.message : "Withdrawal failed.");
      }
      setPhase("error");
    }
  }, [phase, ready, privyWallet, walletAddress, position.id, position.principalUsdc, router]);

  if (position.status !== "active") return null;

  if (phase === "done" && result) {
    return (
      <section aria-label="Redemption confirmed" className="product-doc-section">
        <div className="product-doc-inline-row">
          <span className="body-sm ct-text-strong">Redemption confirmed</span>
          <ProvenanceBadge kind="manual" />
        </div>
        <p className="body-xs ct-text-muted">
          ~{formatUsdFull(result.assetsUsdc)} USDC redeemed. Your
          position is now closed.
        </p>
        <a
          href={explorerTxUrlFromRegistry(result.txHash)}
          target="_blank"
          rel="noreferrer noopener"
          className="body-xs ct-text-accent-strong no-underline hover:underline font-medium"
        >
          {shortHash(result.txHash)} — view on BaseScan (Sepolia) ↗
        </a>
      </section>
    );
  }

  const busy = phase === "redeeming" || phase === "recording";
  const connected = ready && walletAddress !== null;

  if (phase === "confirm" || busy) {
    return (
      <section aria-label="Review withdrawal" className="product-doc-section">
        <Card className="vault-confirm-panel">
          <p className="eyebrow">Review your withdrawal before signing</p>
          <div className="vault-confirm-panel__rows">
            <div className="vault-confirm-panel__row body-sm">
              <span className="ct-text-muted min-w-0">Action</span>
              <span className="ct-text-body font-semibold">Withdraw</span>
            </div>
            <div className="vault-confirm-panel__row body-sm">
              <span className="ct-text-muted min-w-0">Amount</span>
              <span className="ct-text-strong font-semibold tabular">
                Full position
              </span>
            </div>
            <div className="vault-confirm-panel__row body-sm">
              <span className="ct-text-muted min-w-0">You receive</span>
              <span className="ct-text-body">USDC</span>
            </div>
            <div className="vault-confirm-panel__row body-sm">
              <span className="ct-text-muted min-w-0 shrink-0">Vault</span>
              <span className="ct-text-body font-semibold min-w-0 truncate text-right">
                {position.vaultName ?? "Unassigned vault"}
              </span>
            </div>
            <div className="vault-confirm-panel__row body-sm">
              <span className="ct-text-muted min-w-0">Network</span>
              <span className="ct-text-body">Base Sepolia</span>
            </div>
          </div>
          <p className="body-xs ct-text-muted">
            You are withdrawing your full position from the vault, subject to the
            {position.softLockupDays}-day soft lock-up. You&rsquo;ll be asked to confirm this transaction
            in your wallet. Past performance does not predict future results.
          </p>
          <div className="vault-form-actions">
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={handleCancel}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={() => void handleConfirmWithdraw()}
              disabled={busy}
              className="vault-form-actions__primary"
            >
              {phase === "redeeming"
                ? "Confirm in wallet…"
                : phase === "recording"
                  ? "Recording…"
                  : "Confirm withdrawal"}
            </Button>
          </div>
        </Card>
        {error !== null && (
          <p role="alert" className="body-xs ct-status-danger">
            {error}
          </p>
        )}
      </section>
    );
  }

  return (
    <section aria-label="Position actions" className="product-doc-section">
      <p className="body-xs ct-text-muted">
        Withdraw returns your full position as USDC, subject to the {position.softLockupDays}-day soft
        lock-up. Past performance does not predict future results.
      </p>
      <Button
        type="button"
        variant="primary"
        size="lg"
        disabled={!connected}
        onClick={handleReview}
        className="font-semibold"
      >
        {connected ? "Withdraw" : "Connect wallet to withdraw"}
      </Button>
      {error !== null && (
        <p role="alert" className="body-xs ct-status-danger">
          {error}
        </p>
      )}
    </section>
  );
}
