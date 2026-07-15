import { ApyRange } from "@/components/catalyst/apy-range";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { cn } from "@/lib/cn";
import type { VaultProduct } from "@/lib/data/vaults";
import { buildProjectionSeries } from "@/lib/projection-chart";
import { PRODUCT_DURATION_MONTHS } from "@/lib/products/dynavault-factsheet";
import { formatUsdFull } from "@/lib/vaults/product-display";

/**
 * Product term of the mining note — methodology v3.0 §2 ("Term: 24 months",
 * mirroring `productDurationMonths()` on-chain). Sourced from the factsheet so
 * the horizon is never re-typed here. The 60-day soft lock-up is a
 * contractual/applicative exit gate (v3.0 §2) — it is NOT a realisation date,
 * so nothing on this panel is projected "at soft close".
 */
const TERM_MONTHS = PRODUCT_DURATION_MONTHS;

interface MaturityBand {
  totalLow: number;
  totalHigh: number;
  accumulatedLow: number;
  accumulatedHigh: number;
  /**
   * Split-bar geometry only. The mid-band is a legitimate MODEL/TRACE input
   * (it sizes the two segments); it is never published as a figure —
   * non-negotiable #1: the investor only ever reads a range.
   */
  accumulatedShare: number;
}

function maturityBand(amount: number, vault: VaultProduct): MaturityBand | null {
  if (amount <= 0) return null;

  const series = buildProjectionSeries(
    amount,
    vault.apyLow,
    vault.apyHigh,
    TERM_MONTHS,
  );
  const totalLow = series.low.at(-1)?.nav;
  const totalHigh = series.high.at(-1)?.nav;
  const totalMid = series.mid.at(-1)?.nav;
  if (totalLow === undefined || totalHigh === undefined || totalMid === undefined) {
    return null;
  }

  return {
    totalLow,
    totalHigh,
    accumulatedLow: Math.max(0, totalLow - amount),
    accumulatedHigh: Math.max(0, totalHigh - amount),
    accumulatedShare:
      totalMid > 0
        ? Math.min(100, Math.max(0, ((totalMid - amount) / totalMid) * 100))
        : 0,
  };
}

/** Formats a USD band. There is no single-point counterpart on purpose. */
function usdBand(low: number, high: number): string {
  return `${formatUsdFull(low)}–${formatUsdFull(high)}`;
}

interface DepositSummaryProps {
  vault: VaultProduct;
  amount: number;
}

export function DepositSummary({ vault, amount }: DepositSummaryProps) {
  const band = maturityBand(amount, vault);

  const mgmtFee = vault.fees.mgmtBps / 100;
  const perfFee = vault.fees.perfBps / 100;
  const hurdleFee = vault.fees.hurdleBps > 0 ? vault.fees.hurdleBps / 100 : null;

  const hasAmount = band !== null;
  const accumulatedShare = band?.accumulatedShare ?? 0;
  const principalShare = 100 - accumulatedShare;

  return (
    <section className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-[var(--ct-shadow-soft)] overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-end justify-between p-5 border-b border-[var(--ct-border-soft)]">
        <div className="flex flex-col gap-1.5">
          <h2 className="text-[length:var(--ct-text-micro)] font-bold text-[var(--ct-text-muted)] uppercase tracking-[0.15em] leading-none">
            Deposit Summary
          </h2>
          <p className="text-[length:var(--ct-text-2xs)] text-[var(--ct-text-faint)] tracking-wide">
            Projected allocation outcome
          </p>
        </div>
        <ProvenanceBadge kind="estimated" />
      </div>

      {/* Headline projected band — at maturity of the term (v3.0 §2), as a
          range (non-negotiable #1). Never a point, never at soft close. */}
      <div className="flex flex-col gap-2 p-5 border-b border-[var(--ct-border-soft)]">
        <span className="ct-bento-label">
          {hasAmount
            ? `Projected value at maturity (gross) · ${TERM_MONTHS} months`
            : "Allocation preview — enter amount"}
        </span>
        <span
          className={cn(
            "text-[length:var(--ct-text-28-fixed)] font-medium leading-none tracking-tight tabular-nums transition-all duration-150",
            hasAmount ? "text-[var(--ct-text-strong)]" : "text-[var(--ct-text-faint)]",
          )}
        >
          {band !== null ? `${usdBand(band.totalLow, band.totalHigh)} USDC` : "—"}
        </span>
        <span className="text-[length:var(--ct-text-2xs)] text-[var(--ct-text-faint)] leading-relaxed">
          Estimated range in accumulated BTC, delivered at maturity — no periodic
          cash distribution, not guaranteed.
        </span>
      </div>

      {/* Principal / accumulation split bar + legend */}
      <div className="flex flex-col gap-4 p-5 border-b border-[var(--ct-border-soft)]">
        <div
          className="relative h-2 flex overflow-hidden rounded-full border border-[var(--ct-border-soft)] bg-surface-inset"
          role="img"
          aria-label={
            band !== null
              ? `Principal ${formatUsdFull(amount)}, projected gross accumulation ${usdBand(band.accumulatedLow, band.accumulatedHigh)} over the ${TERM_MONTHS}-month term`
              : "Enter an amount to see the principal and accumulation split"
          }
        >
          <span
            className="h-full bg-[var(--ct-text-faint)] transition-all duration-150 ease-out"
            style={{ width: `${hasAmount ? principalShare : 100}%` }}
          />
          {hasAmount && accumulatedShare > 0 ? (
            <span
              className="h-full bg-[color-mix(in_srgb,var(--ct-accent)_40%,transparent)] transition-all duration-150 ease-out"
              style={{ width: `${accumulatedShare}%` }}
            />
          ) : null}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 transition-opacity duration-150">
            <span className="size-2.5 rounded-full border-2 border-[var(--ct-surface-inset)] bg-[var(--ct-text-faint)]" />
            <span className="text-[length:var(--ct-text-xs)] text-[var(--ct-text-muted)]">Principal</span>
            <span className="text-[length:var(--ct-text-xs)] font-medium text-[var(--ct-text-strong)] tabular-nums">
              {hasAmount ? `${formatUsdFull(amount)} USDC` : "—"}
            </span>
          </div>
          <div
            className={cn(
              "grid grid-cols-[auto_1fr_auto] items-center gap-3 transition-opacity duration-150",
              !hasAmount && "opacity-[var(--ct-opacity-40)]",
            )}
          >
            <span className="size-2.5 rounded-full border-2 border-[var(--ct-surface-inset)] bg-[color-mix(in_srgb,var(--ct-accent)_40%,transparent)]" />
            <span className="text-[length:var(--ct-text-xs)] text-[var(--ct-text-muted)]">
              Est. gross accumulation · {TERM_MONTHS} mo
            </span>
            <span className="text-[length:var(--ct-text-xs)] font-medium text-[var(--ct-text-strong)] tabular-nums">
              {band !== null
                ? `~${usdBand(band.accumulatedLow, band.accumulatedHigh)}`
                : "—"}
            </span>
          </div>
        </div>
      </div>

      {/* KPI grid */}
      <dl className="grid grid-cols-1 sm:grid-cols-2 border-b border-[var(--ct-border-soft)] bg-surface-inset">
        <div className="flex flex-col gap-2 p-5 border-b sm:border-r border-[var(--ct-border-soft)]">
          <dt className="ct-bento-label">
            Est. yield range
          </dt>
          <dd>
            <ApyRange
              low={vault.apyLow}
              high={vault.apyHigh}
              precision={1}
              className="text-[length:var(--ct-text-xl-fixed)] font-medium text-[var(--ct-text-strong)] leading-none tracking-tight tabular-nums"
            />
          </dd>
        </div>
        {/* The note pays no rate and carries no fixed APY (v3.0 §2/§3), so there
            is no annual cash-yield figure to publish here — the tile states the
            term and the delivery instead. */}
        <div className="flex flex-col gap-2 p-5 border-b border-[var(--ct-border-soft)]">
          <dt className="ct-bento-label">
            Term
          </dt>
          <dd className="text-[length:var(--ct-text-xl-fixed)] font-medium text-[var(--ct-text-strong)] leading-none tracking-tight tabular-nums">
            {TERM_MONTHS} mo · BTC at maturity
          </dd>
        </div>
        <div className="flex flex-col gap-2 p-5 sm:border-r border-[var(--ct-border-soft)]">
          <dt className="ct-bento-label">
            Lock-up
          </dt>
          <dd className="text-[length:var(--ct-text-xl-fixed)] font-medium text-[var(--ct-text-strong)] leading-none tracking-tight tabular-nums">
            {vault.softLockupDays}d soft
          </dd>
        </div>
        <div className="flex flex-col gap-2 p-5">
          <dt className="ct-bento-label">
            Fees
          </dt>
          <dd className="text-[length:var(--ct-text-xl-fixed)] font-medium text-[var(--ct-text-strong)] leading-none tracking-tight tabular-nums">
            {mgmtFee.toFixed(2)}% · {perfFee.toFixed(0)}%
            {hurdleFee ? ` · ${hurdleFee.toFixed(1)}%` : ""}
          </dd>
        </div>
      </dl>

      {/* Disclaimer */}
      <p className="p-5 text-[length:var(--ct-text-micro)] leading-relaxed text-[var(--ct-text-faint)]">
        Figures shown are gross (before fees). Net accumulation after management
        and performance fees is lower. Estimated return is expressed as a range in
        accumulated BTC over the {TERM_MONTHS}-month term and delivered at
        maturity — no periodic cash distribution, no fixed APY, and not
        guaranteed. The {vault.softLockupDays}-day soft lock-up is contractual and
        is not a realisation date. Methodology v3.0.
      </p>
    </section>
  );
}
