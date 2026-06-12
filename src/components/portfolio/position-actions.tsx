"use client";

// PositionActions — self-served withdrawal for /portfolio/[positionId].
// Client Component. Testnet ERC-4626 redeem path:
//   connect wallet → review & confirm → redeem(all shares) on Base Sepolia →
//   record withdrawal → confirmation.
// Non-negotiable #5: no forbidden words in copy.
//
// Two-step confirmation (mirrors the deposit flow): clicking "Withdraw" only
// opens an explicit review card — NO wallet/contract call fires until the user
// clicks "Confirm withdrawal". This is the institutional-trust requirement: a
// financial action is never one click away from a wallet signature.
//
// User-facing copy says "Withdraw" (not "Redeem"); internal contract names
// (redeemFromVault / redeem) are unchanged.
//
// Wallet connect is via Privy (same as the deposit flow). When Privy is not
// configured, the connect state is shown — never a simulated transaction.

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { usePrivy, useWallets } from "@privy-io/react-auth";

import { Button } from "@/components/ui/button";
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

// ---------------------------------------------------------------------------
// Pure phase-machine contract (exported for unit tests).
//
// The project's component tests assert logic contracts rather than render DOM
// (no jsdom / @testing-library installed). These helpers encode the two-step
// invariant precisely so it can be tested without a renderer:
//   - clicking "Withdraw" only ever moves idle/error → confirm (no chain call);
//   - the on-chain path may run ONLY from the "confirm" phase;
//   - "Cancel" always returns to idle.
// ---------------------------------------------------------------------------

/** Resolve the phase after the intent click ("Withdraw"). Never reaches chain. */
export function phaseAfterReviewClick(current: Phase): Phase {
  // From a resting state, open the review card. While a transaction is in
  // flight ("redeeming"/"recording") or finished ("done"), the intent button is
  // not shown, so the phase is unchanged.
  return current === "idle" || current === "error" ? "confirm" : current;
}

/** Phase after "Cancel" on the review card — always back to idle, no side effect. */
export function phaseAfterCancel(): Phase {
  return "idle";
}

/** Whether the on-chain withdrawal may run given the current phase. */
export function canRunOnChainWithdraw(current: Phase): boolean {
  return current === "confirm";
}

/**
 * Guard: the live flow uses Privy hooks (usePrivy/useWallets) which THROW when
 * no PrivyProvider is mounted — and the provider is a pass-through when
 * NEXT_PUBLIC_PRIVY_APP_ID is unset. So when Privy is not configured we render a
 * static notice and NEVER call the hooks (build-time env → stable branch, rules
 * of hooks respected). Mirrors PrivyWalletConnect's inner/placeholder split.
 */
export function PositionActions({ position }: PositionActionsProps) {
  if (position.status !== "active") return null;
  if (!process.env.NEXT_PUBLIC_PRIVY_APP_ID) {
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

  // Step A — intent. Pure UI: opens the review card, fires NO wallet/contract
  // call. Guards that would block the action are still surfaced up front so the
  // user is not invited to review something that cannot proceed.
  const handleReview = useCallback(() => {
    setError(null);
    if (!VAULT_ADDRESS) {
      setError("Vault address not configured.");
      setPhase("error");
      return;
    }
    if (!ready || !privyWallet || walletAddress === null) {
      setError("Connect your wallet to withdraw.");
      setPhase("error");
      return;
    }
    setPhase((p) => phaseAfterReviewClick(p));
  }, [ready, privyWallet, walletAddress]);

  // Cancel — return to the initial state with no side effect.
  const handleCancel = useCallback(() => {
    setError(null);
    setPhase(phaseAfterCancel());
  }, []);

  // Step B — confirmation. The ONLY path that touches the chain. Reachable only
  // from the "confirm" phase (the review card's "Confirm withdrawal" button).
  const handleConfirmWithdraw = useCallback(async () => {
    // Defence in depth: never run the on-chain path unless we are explicitly in
    // the confirm step. Prevents any accidental direct invocation.
    if (!canRunOnChainWithdraw(phase)) return;

    setError(null);
    if (!VAULT_ADDRESS) {
      setError("Vault address not configured.");
      setPhase("error");
      return;
    }
    if (!ready || !privyWallet || walletAddress === null) {
      setError("Connect your wallet to withdraw.");
      setPhase("error");
      return;
    }

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

      // Record the off-chain side: close/reduce the DB position + transaction.
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
          href={`https://sepolia.basescan.org/tx/${result.txHash}`}
          target="_blank"
          rel="noreferrer noopener"
          className="body-xs text-(--ct-accent-strong) no-underline hover:underline font-medium"
        >
          {shortHash(result.txHash)} — view on BaseScan (Sepolia) ↗
        </a>
      </section>
    );
  }

  const busy = phase === "redeeming" || phase === "recording";
  const connected = ready && walletAddress !== null;

  // Step B — explicit review card. No chain call has fired yet; the only way to
  // the chain from here is the "Confirm withdrawal" button.
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
            60-day soft lock-up. You&rsquo;ll be asked to confirm this transaction
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

  // Step A — intent. Clicking "Withdraw" only opens the review card above.
  return (
    <section aria-label="Position actions" className="product-doc-section">
      <p className="body-xs ct-text-muted">
        Withdraw returns your full position as USDC on Base Sepolia (testnet),
        subject to the 60-day soft lock-up. Past performance does not predict
        future results.
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
