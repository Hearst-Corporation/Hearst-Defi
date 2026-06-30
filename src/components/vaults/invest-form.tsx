"use client";

import { useState, useCallback, useDeferredValue } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { usePrivy, useWallets } from "@privy-io/react-auth";

import { cn } from "@/lib/cn";
import {
  BentoPanel,
  BentoHeader,
  BentoLabel,
  BENTO_PRIMARY_BTN,
  BENTO_SECONDARY_BTN,
} from "@/components/catalyst/bento";
import { ApyRange } from "@/components/catalyst/apy-range";
import { Ptai } from "@/components/catalyst/ptai";
import { kycLabel } from "@/lib/profile/kyc-display";
import { DepositSummary } from "@/components/vaults/deposit-summary";
import { PreFlightCheck, isPreFlightReady } from "@/components/vaults/preflight-check";
import { TimeToTargetChart } from "@/components/vaults/time-to-target-chart";
import {
  investConfirmedPath,
  investProductPath,
} from "@/lib/vaults/invest-routes";
import {
  depositToVault,
  walletClientFromProvider,
  VAULT_ADDRESS,
  ConfigError,
  ChainError,
} from "@/lib/onchain/vault";
import { monthsToTarget } from "@/lib/projection-chart";
import { subscribe, checkSubscribeEligibility } from "@/app/actions/subscribe";
import { isPrivyConfigured } from "@/lib/auth/is-privy-configured";
import type { VaultProduct } from "@/lib/data/vaults";
import type { Investor } from "@prisma/client";
import type { SessionUser } from "@/lib/auth/session";
import {
  formatFeeLine,
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
      return "Wallet access pending";
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
        ? `Estimated ${formatUsdAmount(annualYield)} annual yield — range ${vault.apyLow.toFixed(1)}–${vault.apyHigh.toFixed(1)}%. Indicative testnet estimate, not a return projection — subject to assumptions, see methodology v1.0.`
        : `Target APY ${vault.apyLow.toFixed(1)}–${vault.apyHigh.toFixed(1)}%. Indicative testnet estimate, not a return projection — subject to assumptions, see methodology v1.0.`,
  };
}

interface InvestFormProps {
  vault: VaultProduct;
  investor: Investor | null;
  session: SessionUser | null;
}

function InvestTermsStrip({ vault }: { vault: VaultProduct }) {
  return (
    <dl className="grid grid-cols-2 md:grid-cols-4 gap-px rounded-lg overflow-hidden border border-[var(--ct-border-soft)] bg-[var(--ct-border-soft)]">
      <div className="flex flex-col gap-1.5 p-4 bg-surface-inset">
        <dt className="ct-bento-label text-[var(--ct-text-faint)]">
          Target APY
        </dt>
        <dd>
          <ApyRange
            low={vault.apyLow}
            high={vault.apyHigh}
            precision={1}
            className="text-[length:var(--ct-text-xs)] font-medium text-[var(--ct-text-strong)] tabular-nums"
          />
        </dd>
      </div>
      <div className="flex flex-col gap-1.5 p-4 bg-surface-inset">
        <dt className="ct-bento-label text-[var(--ct-text-faint)]">
          Lock-up
        </dt>
        <dd className="text-[length:var(--ct-text-xs)] font-medium text-[var(--ct-text-strong)] tabular-nums">
          {vault.softLockupDays}d soft
        </dd>
      </div>
      <div className="flex flex-col gap-1.5 p-4 bg-surface-inset">
        <dt className="ct-bento-label text-[var(--ct-text-faint)]">
          Min ticket
        </dt>
        <dd className="text-[length:var(--ct-text-xs)] font-medium text-[var(--ct-text-strong)] tabular-nums">
          {formatUsdAmount(vault.minTicketUsdc, true)}
        </dd>
      </div>
      <div className="flex flex-col gap-1.5 p-4 bg-surface-inset">
        <dt className="ct-bento-label text-[var(--ct-text-faint)]">
          Mgmt / Perf
        </dt>
        <dd className="text-[length:var(--ct-text-xs)] font-medium text-[var(--ct-text-strong)] tabular-nums">
          {formatFeeLine(vault.fees)}
        </dd>
      </div>
    </dl>
  );
}

function AmountLedger({
  children,
  isCalculating,
  isValid = true,
  label = "Allocation amount",
  currency = "USDC",
}: {
  children: React.ReactNode;
  isCalculating?: boolean;
  isValid?: boolean;
  label?: string;
  currency?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-surface-inset transition-colors",
        isValid ? "border-[var(--ct-border)]" : "border-[var(--ct-status-danger-border)]",
        isCalculating && "opacity-[var(--ct-opacity-80)]",
      )}
    >
      <div className="flex items-center justify-between px-4 pt-3">
        <span className="ct-bento-label text-[var(--ct-text-faint)]">
          {label}
        </span>
        <span className="text-[length:var(--ct-text-deci)] text-[var(--ct-text-faint)] tabular-nums">{currency}</span>
      </div>
      <div className="px-4 pb-3 pt-1">{children}</div>
    </div>
  );
}

function InvestHelpLinks() {
  return (
    <div className="flex items-center gap-2 text-[length:var(--ct-text-2xs)]">
      <Link
        href="/proof-center"
        className="font-medium text-[var(--ct-accent)] hover:underline"
      >
        Proof Center
      </Link>
      <span className="text-[var(--ct-text-faint)]" aria-hidden>
        ·
      </span>
      <Link
        href="/docs/methodology/v1.0.md"
        className="font-medium text-[var(--ct-accent)] hover:underline"
      >
        Methodology v1.0
      </Link>
    </div>
  );
}

function EligibilityRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 border-b border-[var(--ct-border-soft)] last:border-b-0">
      <span className="text-[length:var(--ct-text-2xs)] text-[var(--ct-text-faint)]">{label}</span>
      <span className="text-[length:var(--ct-text-xs)] tabular-nums">{children}</span>
    </div>
  );
}

function EligibilityChecklist({
  investor,
  session,
}: {
  investor: Investor | null;
  session: SessionUser | null;
}) {
  const kycStatus = investor?.kycStatus ?? "none";
  const accreditation = !!investor?.accreditationAttestedAt;
  const walletConnected = !!session?.walletAddress;

  const kycChipClass =
    kycStatus === "approved"
      ? "border-[color-mix(in_srgb,var(--ct-accent)_30%,transparent)] bg-[color-mix(in_srgb,var(--ct-accent)_10%,transparent)] text-[var(--ct-accent)]"
      : kycStatus === "rejected"
        ? "border-[var(--ct-status-danger-border)] bg-[var(--ct-status-danger-soft)] text-[var(--ct-status-danger)]"
        : kycStatus === "pending"
          ? "border-[var(--ct-status-warning-border)] bg-[var(--ct-status-warning-soft)] text-[var(--ct-status-warning)]"
          : "border-[var(--ct-border)] bg-surface-inset text-[var(--ct-text-muted)]";

  return (
    <BentoPanel>
      <BentoHeader
        title="Eligibility & KYC"
        subtitle="Institutional compliance status"
      />
      <div className="p-5 flex flex-col">
        <EligibilityRow label="KYC status">
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[length:var(--ct-text-deci)] font-bold uppercase tracking-wider",
              kycChipClass,
            )}
          >
            {kycLabel(kycStatus)}
          </span>
        </EligibilityRow>
        <EligibilityRow label="Accreditation">
          {accreditation ? (
            <span className="text-[var(--ct-accent)]">Attested</span>
          ) : (
            <span className="text-[var(--ct-text-faint)]">Pending attestation</span>
          )}
        </EligibilityRow>
        <EligibilityRow label="Wallet readiness">
          {walletConnected ? (
            <span className="text-[var(--ct-accent)]">Linked</span>
          ) : (
            <span className="text-[var(--ct-text-faint)]">Connection pending</span>
          )}
        </EligibilityRow>
        <p className="text-[length:var(--ct-text-micro)] text-[var(--ct-text-faint)] leading-relaxed mt-4">
          Subscription is restricted to verified qualified investors. All status
          flags must be green before final execution.
        </p>
      </div>
    </BentoPanel>
  );
}

function InvestFormProjections({
  amount,
  vault,
  ptai,
}: {
  amount: number;
  vault: VaultProduct;
  ptai: { projection: string; trigger: string; action: string; impact: string };
}) {
  return (
    <section aria-label="Analytics & Projections" className="flex flex-col gap-5">
      <BentoPanel>
        <BentoHeader title="Indicative NAV path — 24 month horizon" />
        <div className="p-5">
          <TimeToTargetChart amount={amount} vault={vault} />
        </div>
      </BentoPanel>

      <BentoPanel>
        <BentoHeader title="PTAI estimate" />
        <div className="p-5">
          <Ptai
            variant="flat"
            projection={ptai.projection}
            trigger={ptai.trigger}
            action={ptai.action}
            impact={ptai.impact}
          />
        </div>
      </BentoPanel>
    </section>
  );
}

function AmountSection({
  vault,
  maxAmount,
  amount,
  rawAmount,
  onAmountChange,
  isCalculating,
  amountValid,
  helper,
  disabled = false,
}: {
  vault: VaultProduct;
  maxAmount: number;
  amount: number;
  rawAmount: string;
  onAmountChange?: (val: string) => void;
  isCalculating?: boolean;
  amountValid: boolean;
  helper: { text: string; variant: "ok" | "warn" | "neutral" };
  disabled?: boolean;
}) {
  const inputId = disabled ? "amt-input-disabled" : "amt-input";
  const helperId = disabled ? "amt-helper-disabled" : "amt-helper";

  return (
    <BentoPanel>
      <BentoHeader
        title="Allocation amount"
        subtitle="Base Sepolia pilot · testnet USDC only · not mainnet"
      />
      <div className="p-5 flex flex-col gap-5">
        <div className="flex flex-col gap-3">
          <BentoLabel htmlFor={inputId}>Allocation amount</BentoLabel>
          <AmountLedger
            isCalculating={isCalculating}
            isValid={amount === 0 || amountValid}
          >
            <div className="flex items-baseline gap-1.5">
              <span
                aria-hidden
                className="text-[20px] font-medium text-[var(--ct-text-faint)] tabular-nums"
              >
                $
              </span>
              <input
                id={inputId}
                type={disabled ? "text" : "number"}
                min={disabled ? undefined : vault.minTicketUsdc}
                max={disabled ? undefined : maxAmount}
                step={disabled ? undefined : 1000}
                value={rawAmount}
                onChange={
                  disabled ? undefined : (e) => onAmountChange?.(e.target.value)
                }
                disabled={disabled}
                readOnly={disabled}
                placeholder={formatUsdcGrouped(vault.minTicketUsdc)}
                aria-describedby={helperId}
                aria-invalid={!disabled && amount > 0 && !amountValid}
                className={cn(
                  "w-full bg-transparent border-0 p-0 text-[28px] font-medium text-[var(--ct-text-strong)] tabular-nums leading-none outline-none placeholder:text-[var(--ct-text-faint)] focus:outline-none",
                  disabled && "text-[var(--ct-text-faint)]",
                  !disabled && amount > 0 && !amountValid && "text-[var(--ct-status-danger)]",
                )}
              />
            </div>
          </AmountLedger>

          <p
            id={helperId}
            className={cn(
              "text-[length:var(--ct-text-2xs)] px-1",
              helper.variant === "ok" && "text-[var(--ct-accent)]",
              helper.variant === "warn" && "text-[var(--ct-status-warning)]",
              helper.variant === "neutral" && "text-[var(--ct-text-faint)]",
            )}
          >
            {helper.text}
          </p>
        </div>

        <InvestTermsStrip vault={vault} />
      </div>
    </BentoPanel>
  );
}

export function InvestForm({ vault, investor, session }: InvestFormProps) {
  if (!isPrivyConfigured()) {
    return <InvestFormUnconfigured vault={vault} investor={investor} session={session} />;
  }
  return <InvestFormLive vault={vault} investor={investor} session={session} />;
}

function InvestFormUnconfigured({
  vault,
  investor,
  session,
}: {
  vault: VaultProduct;
  investor: Investor | null;
  session: SessionUser | null;
}) {
  const maxAmount = vault.capacityUsdc - vault.currentAumUsdc;
  const ptai = buildPtai(0, vault);
  const helper = {
    text: `Minimum ${formatUsdAmount(vault.minTicketUsdc, true)} · Capacity remaining: ${formatUsdAmount(maxAmount, true)}`,
    variant: "neutral" as const,
  };

  return (
    <div className="dark flex flex-col gap-5">
      <AmountSection
        vault={vault}
        maxAmount={maxAmount}
        amount={0}
        rawAmount=""
        amountValid={false}
        helper={helper}
        disabled
      />

      <DepositSummary vault={vault} amount={0} />

      <PreFlightCheck
        walletAddress={null}
        amount={0}
        onAllowanceApproved={() => {}}
        allowanceApproved={false}
        approving={false}
        onApproveStart={() => {}}
        onApproveEnd={() => {}}
      />

      <BentoPanel>
        <div className="p-5 flex flex-col gap-5">
          <div>
            <label className="flex items-start gap-3 cursor-default opacity-[var(--ct-opacity-60)]">
              <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border border-[var(--ct-border)] bg-surface-inset" />
              <span className="text-[length:var(--ct-text-xs)] text-[var(--ct-text-body)] leading-snug">
                I have reviewed and accept the term sheet for {vault.name}.
              </span>
            </label>
            <p className="text-[length:var(--ct-text-micro)] text-[var(--ct-text-faint)] leading-relaxed mt-2 ml-7">
              Structured product exclusively for qualified investors. Review the
              full subscription agreement before proceeding.
            </p>
          </div>

          <div className="rounded-lg border border-[var(--ct-border-soft)] bg-surface-inset p-4">
            <p className="text-[length:var(--ct-text-xs)] text-[var(--ct-text-muted)] m-0">
              Wallet connection will be enabled for your account before deposit
              signing.
            </p>
            <p className="text-[length:var(--ct-text-micro)] text-[var(--ct-text-faint)] leading-relaxed m-0 mt-1.5">
              You can review the subscription path, assumptions, and checks now,
              then continue once wallet access is provisioned.
            </p>
          </div>

          <InvestHelpLinks />

          <div className="flex items-center justify-between gap-3">
            <Link href={investProductPath(vault.id)} className={BENTO_SECONDARY_BTN}>
              ← Back
            </Link>
            <button type="button" disabled className={BENTO_PRIMARY_BTN}>
              Connect a wallet to continue
            </button>
          </div>
        </div>
      </BentoPanel>

      <EligibilityChecklist investor={investor} session={session} />

      <InvestFormProjections amount={0} vault={vault} ptai={ptai} />
    </div>
  );
}

function InvestFormLive({
  vault,
  investor,
  session,
}: {
  vault: VaultProduct;
  investor: Investor | null;
  session: SessionUser | null;
}) {
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
  const isCalculating = amount !== deferredAmount;

  const amountValid = amount >= vault.minTicketUsdc && amount <= maxAmount;

  // Epoch gating is status-only (no real deadline feed) — see preflight-check.
  const epochIndicative = { status: "ACTIVE" as const };

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
      setDepositError("Please connect your wallet to continue.");
      setAwaitingConfirm(false);
      return;
    }

    if (!VAULT_ADDRESS) {
      setDepositError("Deposit access is temporarily unavailable. Please contact Investor Relations.");
      setAwaitingConfirm(false);
      return;
    }

    const eligibility = await checkSubscribeEligibility(vault.id);
    if (!eligibility.ok) {
      setDepositError(eligibility.error);
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

      const sub = await subscribe(
        vault.id,
        amount,
        shareClassCode(vault.shareClass),
        result.txHash,
      );
      if (!sub.ok) {
        setDepositError(
          `Your deposit was confirmed on-chain (tx ${result.txHash.slice(0, 10)}…) but we could not record it. Please contact Investor Relations with this transaction reference.`,
        );
        setDepositing(false);
        setAwaitingConfirm(false);
        return;
      }

      router.push(
        `${investConfirmedPath(vault.id)}?tx=${result.txHash}&amount=${amount}&positionId=${sub.positionId}`,
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
    <div className="dark flex flex-col gap-5">
      <AmountSection
        vault={vault}
        maxAmount={maxAmount}
        amount={amount}
        rawAmount={rawAmount}
        onAmountChange={(val) => {
          setRawAmount(val);
          setAllowanceApproved(false);
          setAwaitingConfirm(false);
        }}
        isCalculating={isCalculating}
        amountValid={amountValid}
        helper={helper}
      />

      <DepositSummary vault={vault} amount={amount} />

      {amount === 0 ? null : (
        <PreFlightCheck
          walletAddress={walletAddress}
          amount={amount}
          onAllowanceApproved={() => setAllowanceApproved(true)}
          allowanceApproved={allowanceApproved}
          approving={approving}
          onApproveStart={() => setApproving(true)}
          onApproveEnd={() => setApproving(false)}
          onApproveError={(msg) => setDepositError(msg)}
        />
      )}

      {amount === 0 ? null : (
        <BentoPanel>
          <div className="p-5 flex flex-col gap-5">
            <div>
              <label
                htmlFor="invest-term-sheet"
                className="flex items-start gap-3 cursor-pointer"
              >
                <span className="relative mt-0.5 flex size-4 shrink-0 items-center justify-center">
                  <input
                    id="invest-term-sheet"
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
                      "flex size-4 items-center justify-center rounded border transition-colors",
                      agreedToTermSheet
                        ? "border-[var(--ct-accent)] bg-[var(--ct-accent)]"
                        : "border-[var(--ct-border)] bg-surface-inset",
                    )}
                  >
                    {agreedToTermSheet ? (
                      <svg
                        viewBox="0 0 12 12"
                        fill="none"
                        className="size-2.5 text-[var(--ct-bg-deep)]"
                      >
                        <path
                          d="M2 6l3 3 5-6"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : null}
                  </span>
                </span>
                <span className="text-[length:var(--ct-text-xs)] text-[var(--ct-text-body)] leading-snug">
                  I have reviewed and accept the{" "}
                  <Link
                    href={investProductPath(vault.id)}
                    className="underline text-[var(--ct-accent)] hover:text-[var(--ct-text-strong)]"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    term sheet
                  </Link>{" "}
                  for {vault.name}.
                </span>
              </label>
              <p className="text-[length:var(--ct-text-micro)] text-[var(--ct-text-faint)] leading-relaxed mt-2 ml-7">
                Structured product exclusively for qualified investors. Review
                the full subscription agreement before proceeding.
              </p>
            </div>

            {depositError ? (
              <div
                role="alert"
                className="rounded-lg border border-[var(--ct-status-danger-border)] bg-[var(--ct-status-danger-soft)] p-4"
              >
                <p className="text-[length:var(--ct-text-2xs)] text-[var(--ct-status-danger)] m-0">{depositError}</p>
              </div>
            ) : null}

            {awaitingConfirm ? (
              <div
                className="rounded-lg border border-[var(--ct-border)] bg-surface-inset p-5 flex flex-col gap-4"
                aria-label="Confirm your deposit"
              >
                <div className="flex items-baseline justify-between">
                  <p className="ct-bento-label text-[var(--ct-text-faint)] m-0">
                    Confirm allocation
                  </p>
                  <span className="inline-flex items-center rounded-full border border-[color-mix(in_srgb,var(--ct-accent)_30%,transparent)] px-2.5 py-0.5 text-[length:var(--ct-text-deci)] font-bold uppercase tracking-wider text-[var(--ct-accent)]">
                    Review mode
                  </span>
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center justify-between gap-4 py-2 border-b border-[var(--ct-border-soft)] text-[length:var(--ct-text-xs)]">
                    <span className="text-[var(--ct-text-faint)]">Vault</span>
                    <span className="text-[var(--ct-text-strong)] font-semibold">{vault.name}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4 py-2 border-b border-[var(--ct-border-soft)] text-[length:var(--ct-text-xs)]">
                    <span className="text-[var(--ct-text-faint)]">Share class</span>
                    <span className="text-[var(--ct-text-strong)] tabular-nums">
                      Class {shareClassCode(vault.shareClass)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4 py-2 border-b border-[var(--ct-border-soft)] text-[length:var(--ct-text-xs)]">
                    <span className="text-[var(--ct-text-faint)]">Amount</span>
                    <span className="text-[var(--ct-text-strong)] font-semibold tabular-nums">
                      {formatUsdAmount(amount)} USDC
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4 py-2 border-b border-[var(--ct-border-soft)] text-[length:var(--ct-text-xs)]">
                    <span className="text-[var(--ct-text-faint)]">Target APY</span>
                    <ApyRange
                      low={vault.apyLow}
                      high={vault.apyHigh}
                      precision={1}
                      className="text-[length:var(--ct-text-xs)] font-medium text-[var(--ct-text-strong)] tabular-nums"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-4 py-2 border-b border-[var(--ct-border-soft)] text-[length:var(--ct-text-xs)]">
                    <span className="text-[var(--ct-text-faint)]">Lock-up</span>
                    <span className="text-[var(--ct-text-strong)] tabular-nums">
                      {vault.softLockupDays}d soft
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4 py-2 border-b border-[var(--ct-border-soft)] text-[length:var(--ct-text-xs)]">
                    <span className="text-[var(--ct-text-faint)]">Network</span>
                    <span className="text-[var(--ct-text-strong)]">Base Sepolia (testnet)</span>
                  </div>
                  <div className="flex items-center justify-between gap-4 py-2 text-[length:var(--ct-text-xs)]">
                    <span className="text-[var(--ct-text-faint)]">Action</span>
                    <span className="text-[var(--ct-text-strong)]">Deposit</span>
                  </div>
                </div>
                <p className="text-[length:var(--ct-text-micro)] text-[var(--ct-text-faint)] leading-relaxed m-0">
                  Base Sepolia testnet transaction — for pilot testing only.
                  Irreversible once submitted. Subject to{" "}
                  {vault.softLockupDays}-day soft lock-up. Target APY shown as a
                  range — indicative estimate, not a return projection. See
                  methodology v1.0.
                </p>
                <div className="flex items-center justify-between gap-3 pt-1">
                  <button
                    type="button"
                    onClick={handleCancelConfirm}
                    disabled={depositing}
                    className={BENTO_SECONDARY_BTN}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleConfirm()}
                    disabled={!ctaEnabled || depositing}
                    className={BENTO_PRIMARY_BTN}
                  >
                    {depositing
                      ? "Confirming…"
                      : `Confirm ${formatUsdAmount(amount)} deposit`}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <InvestHelpLinks />

                <div className="flex items-center justify-between gap-3">
                  <Link
                    href={investProductPath(vault.id)}
                    className={BENTO_SECONDARY_BTN}
                  >
                    ← Back
                  </Link>

                  <button
                    type="button"
                    onClick={handleReview}
                    disabled={!ctaEnabled}
                    aria-disabled={!ctaEnabled}
                    className={BENTO_PRIMARY_BTN}
                  >
                    {ctaLabel(currentCtaState, amount)}
                  </button>
                </div>
              </>
            )}
          </div>
        </BentoPanel>
      )}

      {amount === 0 ? null : (
        <EligibilityChecklist investor={investor} session={session} />
      )}

      {amount === 0 ? null : (
        <InvestFormProjections amount={deferredAmount} vault={vault} ptai={ptai} />
      )}
    </div>
  );
}
