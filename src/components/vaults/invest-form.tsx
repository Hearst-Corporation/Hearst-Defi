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
} from "@/components/catalyst/bento";
import { CockpitButton } from "@/components/catalyst/cockpit-button";
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
import { monthsToTargetRange } from "@/lib/projection-chart";
import { subscribe, checkSubscribeEligibility } from "@/app/actions/subscribe";
import { DemoDepositSimulate } from "@/components/vaults/demo-deposit-simulate";
import { isDemoAccount } from "@/lib/demo/allowlist";
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
import { series1DisplayName } from "@/lib/vaults/series1";

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

/**
 * Product term of the mining note — methodology v3.0 §2 ("Term: 24 months",
 * mirroring `productDurationMonths()` on-chain). `VaultProduct` does not carry
 * the column, so the term is pinned here for every horizon this form renders.
 */
const PRODUCT_TERM_MONTHS = 24;

/**
 * Render a fast/slow milestone-month pair as a human range — never a point.
 * `fast` = the sooner bound (high APY), `slow` = the later bound (low APY).
 *   - both present, differ → "6–9 months"
 *   - both present, equal  → "~6 months"
 *   - only the fast bound reaches the target inside the horizon → "from ~6 months"
 *   - neither reaches it   → "within {horizon} months"
 */
function formatMonthsRange(
  months: { fast: number | null; slow: number | null },
  horizonMonths: number,
): string {
  const { fast, slow } = months;
  if (fast !== null && slow !== null) {
    return fast === slow ? `~${fast} months` : `${fast}–${slow} months`;
  }
  if (fast !== null) {
    // The slow (low-APY) bound never reaches the target inside the horizon.
    return `from ~${fast} months`;
  }
  return `within ${horizonMonths} months`;
}

function buildPtai(
  amount: number,
  vault: VaultProduct,
): { projection: string; trigger: string; action: string; impact: string } {
  // The +10% milestone is published as a FOURCHETTE of months (fast = high APY,
  // slow = low APY) — never a single point (non-negotiable #1: range only). The
  // midpoint is never computed or published here.
  const months10 = monthsToTargetRange(
    vault.apyLow,
    vault.apyHigh,
    10,
    PRODUCT_TERM_MONTHS,
  );
  const months10Str = formatMonthsRange(months10, PRODUCT_TERM_MONTHS);

  // PTAI per methodology v3.0 §8: Action = the pocket / curtailment /
  // take-profit step; Impact = effect on the BTC-accumulation range, the term
  // and the provenance. The note makes no periodic cash distribution (§2), so
  // no cash-yield figure is derived from the ticket size.
  return {
    projection:
      amount > 0
        ? `At ${formatUsdAmount(amount)} principal you reach +10% cumulative BTC accumulation in ${months10Str} under base assumptions.`
        : `Deposit at least ${formatUsdAmount(vault.minTicketUsdc, true)} to see your personalized projection.`,

    trigger:
      `Hashprice ≥ $0.085/TH/day AND BTC ≥ $60,000 AND mining uptime ≥ 95% sustained over 30 days.`,

    action:
      `No periodic cash distribution — BTC accumulates across the three pockets: mining power 40%, BTC pouch 27%, USDC reserve 33%. Take-profit realises BTC at configured price tiers; the mining pocket is curtailed below the configured BTC threshold (Methodology v3.0).`,

    impact:
      `Estimated outcome is expressed as a RANGE of accumulated BTC — never a single figure, never a rate, not distributed and not guaranteed. The accumulated Bitcoin reserve is delivered at maturity of the ${PRODUCT_TERM_MONTHS}-month term. Indicative testnet estimate, subject to assumptions — see methodology v3.0.`,
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
          Term
        </dt>
        <dd className="text-[length:var(--ct-text-xs)] font-medium text-[var(--ct-text-strong)] tabular-nums">
          24 months · BTC at maturity
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
        href="/docs/methodology/v3.0.md"
        className="font-medium text-[var(--ct-accent)] hover:underline"
      >
        Methodology v3.0
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
            <div className="flex items-baseline gap-1.5 lg:max-w-md">
              <span
                aria-hidden
                className="text-[length:var(--ct-text-hero-sym)] font-medium text-[var(--ct-text-faint)] tabular-nums"
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
                placeholder={
                  disabled
                    ? formatUsdcGrouped(vault.minTicketUsdc)
                    : String(vault.minTicketUsdc)
                }
                aria-describedby={helperId}
                aria-invalid={!disabled && amount > 0 && !amountValid}
                className={cn(
                  "w-full bg-transparent border-0 p-0 text-[length:var(--ct-text-28-fixed)] font-medium text-[var(--ct-text-strong)] tabular-nums leading-none outline-none placeholder:text-[var(--ct-text-faint)] focus-visible:rounded-[var(--ct-radius-sm)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ct-accent)]",
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
                I have reviewed and accept the term sheet for {series1DisplayName(vault.name)}.
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
            <CockpitButton
              href={investProductPath(vault.id)}
              variant="secondary"
              shape="rect"
              size="lg"
            >
              ← Back
            </CockpitButton>
            <CockpitButton
              type="button"
              variant="primary"
              shape="rect"
              size="lg"
              disabled
            >
              Connect a wallet to continue
            </CockpitButton>
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

  // Demo accounts subscribe off-chain, so the wallet/network/allowance preflight
  // is presented satisfied and never blocks the flow.
  const demoMode = isDemoAccount(session?.email);

  // Epoch gating is status-only (no real deadline feed) — see preflight-check.
  const epochIndicative = { status: "ACTIVE" as const };

  const preFlightOk =
    demoMode ||
    isPreFlightReady(walletAddress, allowanceApproved, epochIndicative);

  function ctaState(): CtaState {
    if (depositing) return "confirming";
    // Demo accounts subscribe off-chain — skip the wallet + on-chain-config
    // gates entirely; only the product gates (amount, terms) still apply.
    if (demoMode) {
      if (!amountValid) return "enter_amount";
      if (!agreedToTermSheet) return "accept_terms";
      return "ready";
    }
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

    // Demo accounts never reach here: the confirm panel renders the dedicated
    // <DemoDepositSimulate/> off-chain action instead of this on-chain Confirm.
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
          demoMode={demoMode}
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
                  for {series1DisplayName(vault.name)}.
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
                    <span className="text-[var(--ct-text-strong)] font-semibold">{series1DisplayName(vault.name)}</span>
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
                    <span className="text-[var(--ct-text-faint)]">Term</span>
                    <span className="text-[var(--ct-text-strong)] tabular-nums">
                      24 months · delivered in BTC
                    </span>
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
                  {vault.softLockupDays}-day soft lock-up, applied contractually
                  and not enforced on-chain. Estimated return shown as a range in
                  accumulated BTC — not distributed, not guaranteed. See
                  methodology v3.0.
                </p>
                {demoMode ? (
                  // Demo accounts subscribe off-chain — the simulate action IS the
                  // confirm here. Hide the on-chain Confirm/Cancel row so there is
                  // a single, unambiguous CTA that never waits on a wallet.
                  <div className="flex items-center justify-between gap-3 pt-1">
                    <CockpitButton
                      type="button"
                      variant="secondary"
                      shape="rect"
                      size="lg"
                      onClick={handleCancelConfirm}
                    >
                      Cancel
                    </CockpitButton>
                    <DemoDepositSimulate
                      vaultId={vault.id}
                      amountUsdc={amount}
                      shareClass={vault.shareClass}
                    />
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3 pt-1">
                    <CockpitButton
                      type="button"
                      variant="secondary"
                      shape="rect"
                      size="lg"
                      onClick={handleCancelConfirm}
                      disabled={depositing}
                    >
                      Cancel
                    </CockpitButton>
                    <CockpitButton
                      type="button"
                      variant="primary"
                      shape="rect"
                      size="lg"
                      onClick={() => void handleConfirm()}
                      disabled={!ctaEnabled || depositing}
                    >
                      {depositing
                        ? "Confirming…"
                        : `Confirm ${formatUsdAmount(amount)} deposit`}
                    </CockpitButton>
                  </div>
                )}
              </div>
            ) : (
              <>
                <InvestHelpLinks />

                <div className="flex items-center justify-between gap-3">
                  <CockpitButton
                    href={investProductPath(vault.id)}
                    variant="secondary"
                    shape="rect"
                    size="lg"
                  >
                    ← Back
                  </CockpitButton>

                  <CockpitButton
                    type="button"
                    variant="primary"
                    shape="rect"
                    size="lg"
                    onClick={handleReview}
                    disabled={!ctaEnabled}
                    aria-disabled={!ctaEnabled}
                  >
                    {ctaLabel(currentCtaState, amount)}
                  </CockpitButton>
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
