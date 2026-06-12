"use client";

// InvestForm — Step 3 of 4: Deposit form with PTAI projection.
// Non-negotiable #1: APY always range.
// Non-negotiable #3: PTAI mandatory via <Ptai> primitive.
// Non-negotiable #5: no forbidden words — checked via linter in CI.
// Non-negotiable #10: "not guaranteed" disclaimer present.
// Design lock: .tabular on all numeric amounts, no new primitives.

import { useState, useCallback, useDeferredValue } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { usePrivy, useWallets } from "@privy-io/react-auth";

import { cn } from "@/lib/cn";
import { Ptai } from "@/components/ui/ptai";
import { Button } from "@/components/ui/button";
import { NestedCallout, NestedPanel } from "@/components/ui/nested-panel";
import { DepositSummary } from "@/components/vaults/deposit-summary";
import { PreFlightCheck, isPreFlightReady } from "@/components/vaults/preflight-check";
import { TimeToTargetChart } from "@/components/vaults/time-to-target-chart";
import {
  depositToVault,
  walletClientFromProvider,
  VAULT_ADDRESS,
  ConfigError,
  ChainError,
} from "@/lib/onchain/vault";
import { monthsToTarget } from "@/lib/projection-chart";
import { subscribe } from "@/app/actions/subscribe";
import type { VaultProduct } from "@/lib/data/vaults";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatUsd(n: number, compact = false): string {
  if (compact && n >= 1_000_000) {
    return `$${(n / 1_000_000).toFixed(1)}M`;
  }
  if (compact && n >= 1_000) {
    return `$${(n / 1_000).toFixed(0)}k`;
  }
  return `$${n.toLocaleString("en-US")}`;
}

// ---------------------------------------------------------------------------
// CTA label morph logic
// ---------------------------------------------------------------------------

type CtaState =
  | "no_wallet"
  | "no_vault_config"
  | "enter_amount"
  | "accept_terms"
  | "complete_preflight"
  | "confirming"
  | "ready";

function ctaLabel(state: CtaState, amount: number): string {
  switch (state) {
    case "no_wallet":
      return "Connect a wallet to continue";
    case "no_vault_config":
      return "Configuration en attente";
    case "enter_amount":
      return "Enter amount to confirm";
    case "accept_terms":
      return "Accept term sheet to continue";
    case "complete_preflight":
      return "Complete pre-flight check";
    case "confirming":
      return "Confirming…";
    case "ready":
      return amount > 0
        ? `Review deposit · ${formatUsd(amount)} →`
        : "Review deposit →";
  }
}

// ---------------------------------------------------------------------------
// PTAI content — mandatory (#3). No forbidden words (#5).
// ---------------------------------------------------------------------------

function buildPtai(
  amount: number,
  vault: VaultProduct,
): { projection: string; trigger: string; action: string; impact: string } {
  const midApy = (vault.apyLow + vault.apyHigh) / 2;
  const months10 = monthsToTarget(midApy, 10, 24);
  const months10Str = months10 !== null ? `~${months10} months` : "within 24 months";

  const annualYield =
    amount > 0 ? Math.round((amount * midApy) / 100) : null;

  return {
    projection:
      amount > 0
        ? `At ${formatUsd(amount)} principal you reach +10% cumulative yield in ${months10Str} under base assumptions.`
        : `Deposit at least ${formatUsd(vault.minTicketUsdc, true)} to see your personalized projection.`,

    trigger:
      `Hashprice ≥ $0.085/TH/day AND BTC ≥ $60,000 AND mining uptime ≥ 95% sustained over 30 days.`,

    action:
      `Monthly USDC distributions via Distribution.distributedAt on-chain event log. Rebalancing by rule-based triggers (Methodology v1.0).`,

    impact:
      annualYield !== null
        ? `Estimated ${formatUsd(annualYield)} annual yield — range ${vault.apyLow.toFixed(1)}–${vault.apyHigh.toFixed(1)}%. Results are not projected. Subject to assumptions — see methodology v1.0.`
        : `Target APY ${vault.apyLow.toFixed(1)}–${vault.apyHigh.toFixed(1)}%. Results are not projected. Subject to assumptions — see methodology v1.0.`,
  };
}

// ---------------------------------------------------------------------------
// InvestForm
// ---------------------------------------------------------------------------

interface InvestFormProps {
  vault: VaultProduct;
}

export function InvestForm({ vault }: InvestFormProps) {
  const router = useRouter();
  const { ready } = usePrivy();
  const { wallets } = useWallets();

  const maxAmount = vault.capacityUsdc - vault.currentAumUsdc;

  // Form state
  const [rawAmount, setRawAmount] = useState<string>("");
  const [agreedToTermSheet, setAgreedToTermSheet] = useState(false);
  const [allowanceApproved, setAllowanceApproved] = useState(false);
  const [approving, setApproving] = useState(false);
  const [depositing, setDepositing] = useState(false);
  const [awaitingConfirm, setAwaitingConfirm] = useState(false);
  const [depositError, setDepositError] = useState<string | null>(null);

  // Live wallet from Privy
  const privyWallet = wallets[0] ?? null;
  const walletAddress: string | null = privyWallet?.address ?? null;

  const amount = rawAmount === "" ? 0 : Math.max(0, Number(rawAmount.replace(/,/g, "")));
  const deferredAmount = useDeferredValue(amount);

  // Validity
  const amountValid = amount >= vault.minTicketUsdc && amount <= maxAmount;

  // Epoch — indicative, not live (no on-chain epoch registry in V1).
  const epochIndicative = { status: "ACTIVE" as const, endsInDays: 18 };

  const preFlightOk = isPreFlightReady(walletAddress, allowanceApproved, epochIndicative);

  // CTA gating
  function ctaState(): CtaState {
    if (depositing) return "confirming";
    if (!ready || walletAddress === null) return "no_wallet";
    if (!VAULT_ADDRESS) return "no_vault_config";
    if (!amountValid) return "enter_amount";
    if (!agreedToTermSheet) return "accept_terms";
    if (!preFlightOk) return "complete_preflight";
    return "ready";
  }

  const currentCtaState = ctaState();
  const ctaEnabled = currentCtaState === "ready";

  // Helper text for the amount input
  function amountHelperText(): { text: string; variant: "ok" | "warn" | "neutral" } {
    if (amount === 0) {
      return {
        text: `Minimum ${formatUsd(vault.minTicketUsdc, true)} · Capacity remaining: ${formatUsd(maxAmount, true)}`,
        variant: "neutral",
      };
    }
    if (amount < vault.minTicketUsdc) {
      return {
        text: `Below minimum of ${formatUsd(vault.minTicketUsdc, true)}`,
        variant: "warn",
      };
    }
    if (amount > maxAmount) {
      return {
        text: `Exceeds available capacity (${formatUsd(maxAmount, true)} remaining)`,
        variant: "warn",
      };
    }
    return { text: `Amount valid · ${formatUsd(amount)} USDC`, variant: "ok" };
  }

  const helper = amountHelperText();

  // Step 1 — first CTA click: enter the confirmation staging area
  const handleReview = useCallback(() => {
    if (!ctaEnabled || depositing) return;
    setDepositError(null);
    setAwaitingConfirm(true);
  }, [ctaEnabled, depositing]);

  // Step 2 — second explicit action: actually execute the deposit
  const handleConfirm = useCallback(async () => {
    if (!ctaEnabled || depositing) {
      setAwaitingConfirm(false);
      setDepositError(null);
      return;
    }

    if (!privyWallet) {
      setDepositError("No wallet connected. Connect a wallet first.");
      setAwaitingConfirm(false);
      return;
    }

    if (!VAULT_ADDRESS) {
      setDepositError("Vault address not configured. Contact support.");
      setAwaitingConfirm(false);
      return;
    }

    setDepositing(true);
    setDepositError(null);
    try {
      const provider = await privyWallet.getEthereumProvider();
      const wc = walletClientFromProvider(
        provider,
        privyWallet.address as `0x${string}`,
      );
      const result = await depositToVault({
        walletClient: wc,
        amountUsdc: amount,
        receiver: privyWallet.address as `0x${string}`,
      });

      // On-chain deposit succeeded → record the Position in the DB with the
      // real tx hash so it surfaces in the portfolio. The on-chain settlement
      // and the DB record must not drift apart.
      const sub = await subscribe(vault.id, amount, "A", result.txHash);
      if (!sub.ok) {
        setDepositError(
          `Deposit confirmed on-chain (tx ${result.txHash.slice(0, 10)}…) but recording it failed: ${sub.error}. Contact support with this tx hash.`,
        );
        setDepositing(false);
        setAwaitingConfirm(false);
        return;
      }

      router.push(
        `/vaults/${vault.id}/invest/confirmed?tx=${result.txHash}&amount=${amount}&positionId=${sub.positionId}`,
      );
    } catch (e) {
      let msg = "Deposit failed. Please try again.";
      if (e instanceof ConfigError || e instanceof ChainError) {
        msg = e.message;
      } else if (e instanceof Error) {
        msg = e.message;
      }
      setDepositError(msg);
      setDepositing(false);
      setAwaitingConfirm(false);
    }
  }, [ctaEnabled, depositing, privyWallet, amount, vault, router]);

  // Cancel — return to form without executing
  const handleCancelConfirm = useCallback(() => {
    setAwaitingConfirm(false);
    setDepositError(null);
  }, []);

  const ptai = buildPtai(deferredAmount, vault);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full max-w-5xl mx-auto">
      {/* ── LEFT COLUMN ──────────────────────────────── */}
      <div className="flex flex-col gap-5">
        {/* Amount input */}
        <section aria-labelledby="amt-label">
          <label htmlFor="amt-input" id="amt-label" className="eyebrow block mb-2">
            Amount (USDC)
          </label>

          <div className="relative">
            <span
              aria-hidden
              className="absolute left-4 top-1/2 -translate-y-1/2 mono font-semibold ct-text-muted select-none"
            >
              $
            </span>
            <input
              id="amt-input"
              type="number"
              min={vault.minTicketUsdc}
              max={maxAmount}
              step={1000}
              value={rawAmount}
              onChange={(e) => {
                setRawAmount(e.target.value);
                // Reset allowance when amount changes
                setAllowanceApproved(false);
                setAwaitingConfirm(false);
              }}
              placeholder={vault.minTicketUsdc.toLocaleString("en-US")}
              aria-describedby="amt-helper"
              aria-invalid={amount > 0 && !amountValid}
              className={cn(
                "ct-input tabular w-full pl-8 pr-4 py-3 mono text-lg",
                amount > 0 && !amountValid
                  ? "border-[var(--ct-status-warning-border)] focus:ring-[var(--ct-status-warning)]"
                  : "",
              )}
            />
          </div>

          <p
            id="amt-helper"
            className={cn(
              "body-xs mt-1.5",
              helper.variant === "ok" && "ct-status-success",
              helper.variant === "warn" && "ct-status-warning",
              helper.variant === "neutral" && "ct-text-muted",
            )}
          >
            {helper.text}
          </p>
        </section>

        {/* Term sheet checkbox */}
        <label className="flex items-start gap-3 cursor-pointer group">
          <span className="mt-0.5 relative shrink-0">
            <input
              type="checkbox"
              checked={agreedToTermSheet}
              onChange={(e) => {
                setAgreedToTermSheet(e.target.checked);
                setAwaitingConfirm(false);
              }}
              className="sr-only"
            />
            <span
              aria-hidden
              className={cn(
                "flex items-center justify-center w-5 h-5 rounded border transition-colors",
                agreedToTermSheet
                  ? "bg-[var(--ct-accent)] border-[var(--ct-border-accent)]"
                  : "ct-surface-1 border-[var(--ct-border-soft)] group-hover:border-[var(--ct-border-strong)]",
              )}
            >
              {agreedToTermSheet && (
                <span className="inline-block w-2.5 h-2 rounded-sm bg-[var(--ct-accent)]" />
              )}
            </span>
          </span>
          <span className="body-sm ct-text-body">
            I have reviewed and accept the{" "}
            <Link
              href={`/vaults/${vault.id}`}
              className="underline ct-text-primary hover:ct-text-strong transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              term sheet
            </Link>{" "}
            for {vault.name}. I understand this is a structured product offered
            exclusively to qualified investors.
          </span>
        </label>

        {/* Deposit error */}
        {depositError ? (
          <NestedCallout className="border border-(--ct-status-danger-border) ct-status-danger-bg">
            <p className="body-xs ct-status-danger">{depositError}</p>
          </NestedCallout>
        ) : null}

        {/* CTA row — two-step confirmation */}
        {awaitingConfirm ? (
          <NestedPanel className="space-y-4 border-(--ct-border-strong)">
            <p className="eyebrow">Confirm your deposit</p>
            <div className="space-y-1">
              <div className="flex justify-between body-sm">
                <span className="ct-text-muted">Vault</span>
                <span className="ct-text-body font-semibold">{vault.name}</span>
              </div>
              <div className="flex justify-between body-sm">
                <span className="ct-text-muted">Amount</span>
                <span className="ct-text-strong font-bold tabular">{formatUsd(amount)} USDC</span>
              </div>
              <div className="flex justify-between body-sm">
                <span className="ct-text-muted">Action</span>
                <span className="ct-text-body">Deposit</span>
              </div>
            </div>
            <p className="body-xs ct-text-muted">
              This action is irreversible once submitted. Subject to 60-day soft
              lock-up. Results are not projected — see methodology v1.0.
            </p>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="secondary"
                size="md"
                onClick={handleCancelConfirm}
                disabled={depositing}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={() => void handleConfirm()}
                disabled={!ctaEnabled || depositing}
                className="font-bold flex-1"
              >
                {depositing ? "Confirming…" : `Confirm ${formatUsd(amount)} deposit`}
              </Button>
            </div>
          </NestedPanel>
        ) : (
          <div className="flex items-center gap-3 flex-wrap">
            <Button
              variant="secondary"
              size="md"
              asChild
            >
              <Link href={`/vaults/${vault.id}`}>← Back</Link>
            </Button>

            <Button
              variant="primary"
              size="md"
              onClick={handleReview}
              disabled={!ctaEnabled}
              aria-disabled={!ctaEnabled}
              className={cn(
                "font-bold flex-1",
                !ctaEnabled && "opacity-60 cursor-not-allowed",
              )}
            >
              {ctaLabel(currentCtaState, amount)}
            </Button>
          </div>
        )}

        {/* Time-to-target chart — only when amount is set */}
        {deferredAmount > 0 && (
          <NestedPanel className="mt-1">
            <p className="eyebrow mb-3">Projected NAV — 24 month horizon</p>
            <TimeToTargetChart amount={deferredAmount} vault={vault} />
          </NestedPanel>
        )}

        {/* PTAI block — mandatory (#3) */}
        <div>
          <p className="eyebrow mb-2">Projection (PTAI)</p>
          <Ptai
            projection={ptai.projection}
            trigger={ptai.trigger}
            action={ptai.action}
            impact={ptai.impact}
          />
        </div>
      </div>

      {/* ── RIGHT COLUMN ─────────────────────────────── */}
      <div className="flex flex-col gap-5">
        {/* Deposit summary */}
        <DepositSummary vault={vault} amount={amount} />

        {/* Pre-flight check */}
        <PreFlightCheck
          walletAddress={walletAddress}
          amount={amount}
          vaultId={vault.id}
          onAllowanceApproved={() => setAllowanceApproved(true)}
          allowanceApproved={allowanceApproved}
          approving={approving}
          onApproveStart={() => setApproving(true)}
          onApproveEnd={() => setApproving(false)}
          onApproveError={(msg) => setDepositError(msg)}
        />
      </div>
    </div>
  );
}
