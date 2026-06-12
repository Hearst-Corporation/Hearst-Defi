"use client";

import { useState, useCallback, useDeferredValue } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { usePrivy, useWallets } from "@privy-io/react-auth";

import { cn } from "@/lib/cn";
import { Ptai } from "@/components/ui/ptai";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { PanelStatus } from "@/components/ui/panel-status";
import { DepositSummary } from "@/components/vaults/deposit-summary";
import { PreFlightCheck, isPreFlightReady } from "@/components/vaults/preflight-check";
import { VaultPanelHeader } from "@/components/vaults/vault-flow-primitives";
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
import { isPrivyConfigured } from "@/lib/auth/is-privy-configured";
import type { VaultProduct } from "@/lib/data/vaults";
import {
  formatUsdAmount,
  formatUsdcGrouped,
  shareClassCode,
} from "@/lib/vaults/product-display";

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
        ? `Review deposit · ${formatUsdAmount(amount)} →`
        : "Review deposit →";
  }
}

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
        ? `At ${formatUsdAmount(amount)} principal you reach +10% cumulative yield in ${months10Str} under base assumptions.`
        : `Deposit at least ${formatUsdAmount(vault.minTicketUsdc, true)} to see your personalized projection.`,

    trigger:
      `Hashprice ≥ $0.085/TH/day AND BTC ≥ $60,000 AND mining uptime ≥ 95% sustained over 30 days.`,

    action:
      `Monthly USDC distributions via Distribution.distributedAt on-chain event log. Rebalancing by rule-based triggers (Methodology v1.0).`,

    impact:
      annualYield !== null
        ? `Estimated ${formatUsdAmount(annualYield)} annual yield — range ${vault.apyLow.toFixed(1)}–${vault.apyHigh.toFixed(1)}%. Results are not projected. Subject to assumptions — see methodology v1.0.`
        : `Target APY ${vault.apyLow.toFixed(1)}–${vault.apyHigh.toFixed(1)}%. Results are not projected. Subject to assumptions — see methodology v1.0.`,
  };
}

interface InvestFormProps {
  vault: VaultProduct;
}

export function InvestForm({ vault }: InvestFormProps) {
  if (!isPrivyConfigured()) {
    return (
      <PanelStatus
        message="Wallet connection is being configured."
        detail="Set NEXT_PUBLIC_PRIVY_APP_ID to enable deposits from this environment."
      />
    );
  }
  return <InvestFormLive vault={vault} />;
}

function InvestFormLive({ vault }: InvestFormProps) {
  const router = useRouter();
  const { ready } = usePrivy();
  const { wallets } = useWallets();

  const maxAmount = vault.capacityUsdc - vault.currentAumUsdc;

  const [rawAmount, setRawAmount] = useState<string>("");
  const [agreedToTermSheet, setAgreedToTermSheet] = useState(false);
  const [allowanceApproved, setAllowanceApproved] = useState(false);
  const [approving, setApproving] = useState(false);
  const [depositing, setDepositing] = useState(false);
  const [awaitingConfirm, setAwaitingConfirm] = useState(false);
  const [depositError, setDepositError] = useState<string | null>(null);

  const privyWallet = wallets[0] ?? null;
  const walletAddress: string | null = privyWallet?.address ?? null;

  const amount = rawAmount === "" ? 0 : Math.max(0, Number(rawAmount.replace(/,/g, "")));
  const deferredAmount = useDeferredValue(amount);

  const amountValid = amount >= vault.minTicketUsdc && amount <= maxAmount;

  const epochIndicative = { status: "ACTIVE" as const, endsInDays: 18 };

  const preFlightOk = isPreFlightReady(walletAddress, allowanceApproved, epochIndicative);

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

  function amountHelperText(): { text: string; variant: "ok" | "warn" | "neutral" } {
    if (amount === 0) {
      return {
        text: `Minimum ${formatUsdAmount(vault.minTicketUsdc, true)} · Capacity remaining: ${formatUsdAmount(maxAmount, true)}`,
        variant: "neutral",
      };
    }
    if (amount < vault.minTicketUsdc) {
      return {
        text: `Below minimum of ${formatUsdAmount(vault.minTicketUsdc, true)}`,
        variant: "warn",
      };
    }
    if (amount > maxAmount) {
      return {
        text: `Exceeds available capacity (${formatUsdAmount(maxAmount, true)} remaining)`,
        variant: "warn",
      };
    }
    return { text: `Amount valid · ${formatUsdAmount(amount)} USDC`, variant: "ok" };
  }

  const helper = amountHelperText();

  const handleReview = useCallback(() => {
    if (!ctaEnabled || depositing) return;
    setDepositError(null);
    setAwaitingConfirm(true);
  }, [ctaEnabled, depositing]);

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
      const sub = await subscribe(
        vault.id,
        amount,
        shareClassCode(vault.shareClass),
        result.txHash,
      );
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

  const handleCancelConfirm = useCallback(() => {
    setAwaitingConfirm(false);
    setDepositError(null);
  }, []);

  const ptai = buildPtai(deferredAmount, vault);

  return (
    <div className="vault-invest-grid">
      <div className="vault-invest-form-main">
        <div className="vault-flow-flat-section">
          <VaultPanelHeader title="Deposit amount" />
          <div className="vault-panel-body vault-panel-body--stack">
            <section>
              <label htmlFor="amt-input" className="sr-only">
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
                    setAllowanceApproved(false);
                    setAwaitingConfirm(false);
                  }}
                  placeholder={formatUsdcGrouped(vault.minTicketUsdc)}
                  aria-describedby="amt-helper"
                  aria-invalid={amount > 0 && !amountValid}
                  className={cn(
                    "ct-input tabular w-full pl-8 pr-4 py-3 mono body-lg",
                    amount > 0 && !amountValid
                      ? "ct-bc-warning ct-ring-warning"
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
            <Checkbox
              checked={agreedToTermSheet}
              onChange={(checked) => {
                setAgreedToTermSheet(checked);
                setAwaitingConfirm(false);
              }}
            >
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
            </Checkbox>

            {depositError ? (
              <PanelStatus
                tone="danger"
                role="alert"
                message={depositError}
              />
            ) : null}

            {awaitingConfirm ? (
              <div
                className="vault-confirm-panel border-t border-[var(--ct-border-soft)] pt-4"
                aria-label="Confirm your deposit"
              >
                <p className="eyebrow">Confirm your deposit</p>
                <div className="vault-confirm-panel__rows">
                  <div className="vault-confirm-panel__row body-sm">
                    <span className="ct-text-muted">Vault</span>
                    <span className="ct-text-body font-semibold">{vault.name}</span>
                  </div>
                  <div className="vault-confirm-panel__row body-sm">
                    <span className="ct-text-muted">Amount</span>
                    <span className="ct-text-strong font-semibold tabular-nums">
                      {formatUsdAmount(amount)} USDC
                    </span>
                  </div>
                  <div className="vault-confirm-panel__row body-sm">
                    <span className="ct-text-muted">Action</span>
                    <span className="ct-text-body">Deposit</span>
                  </div>
                </div>
                <p className="body-xs ct-text-muted">
                  This action is irreversible once submitted. Subject to{" "}
                  {vault.softLockupDays}-day soft lock-up. Results are not projected
                  — see methodology v1.0.
                </p>
                <div className="vault-form-actions">
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
                    className="vault-form-actions__primary"
                  >
                    {depositing
                      ? "Confirming…"
                      : `Confirm ${formatUsdAmount(amount)} deposit`}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="vault-form-actions">
                <Button variant="secondary" size="md" asChild>
                  <Link href={`/vaults/${vault.id}`}>← Back</Link>
                </Button>

                <Button
                  variant="primary"
                  size="md"
                  onClick={handleReview}
                  disabled={!ctaEnabled}
                  aria-disabled={!ctaEnabled}
                  className={cn(
                    "vault-form-actions__primary",
                    !ctaEnabled && "opacity-60 cursor-not-allowed",
                  )}
                >
                  {ctaLabel(currentCtaState, amount)}
                </Button>
              </div>
            )}
          </div>
        </div>

        {deferredAmount > 0 && (
          <div className="vault-flow-flat-section">
            <VaultPanelHeader title="Projected NAV — 24 month horizon" />
            <div className="vault-panel-body">
              <TimeToTargetChart amount={deferredAmount} vault={vault} />
            </div>
          </div>
        )}

        <div className="vault-flow-flat-section">
          <VaultPanelHeader title="Projection (PTAI)" />
          <div className="vault-panel-body">
            <Ptai
              projection={ptai.projection}
              trigger={ptai.trigger}
              action={ptai.action}
              impact={ptai.impact}
            />
          </div>
        </div>
      </div>

      <div className="vault-invest-grid__rail">
        <DepositSummary vault={vault} amount={amount} />
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
