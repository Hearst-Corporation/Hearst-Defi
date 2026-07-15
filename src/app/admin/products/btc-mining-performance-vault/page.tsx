export const dynamic = "force-dynamic";

import {
  AdminPageShell,
  AdminSectionCard,
} from "@/components/admin/admin-page-shell";
import { Card } from "@/components/catalyst/card";
import { requireAdmin } from "@/lib/auth/require-admin";
import { BTC_MINING_PERFORMANCE_VAULT } from "@/lib/products/btc-mining-performance-vault";
import { buildBtcMiningVaultBrief } from "@/lib/product-workspace/btc-mining-vault-preset";

/**
 * Admin · BTC Mining Performance Vault — read-only product surface.
 *
 * Renders the committed product (`src/lib/products/*`) as an admin documentation
 * page on the canon shell (AdminPageShell + AdminSectionCard, DS tokens only).
 *
 * Honesty (non-negotiables #1, #5, #10; doc §12, §22):
 *  - figures are READ from BTC_MINING_PERFORMANCE_VAULT;
 *  - v2 is a mining NOTE: the estimated-yield band and the total target are BTC
 *    ACCUMULATED over the term (rule-based take-profit), NEVER a periodic cash
 *    distribution, and the two bands are NEVER summed into a single headline;
 *  - the mining floor (30%) is always visible; configured values are labelled
 *    "configured, not validated" and gated by a warning strip.
 *
 * No data fetch, no record creation, no run, no deploy implied.
 */

const PRODUCT = BTC_MINING_PERFORMANCE_VAULT;

function pct(fraction: number): number {
  return Math.round(fraction * 100);
}

export const metadata = {
  title: "BTC Mining Performance Vault — Hearst Connect",
};

export default async function BtcMiningPerformanceVaultPage() {
  await requireAdmin();

  const brief = buildBtcMiningVaultBrief(PRODUCT);
  const a = PRODUCT.allocation;

  const sleeves: ReadonlyArray<{ id: string; label: string; range: string; note: string }> = [
    {
      id: "mining",
      label: "Mining sleeve",
      range: `${pct(a.mining.min)}–${pct(a.mining.max)}%`,
      note: `Structural floor ${pct(a.mining.floor)}% — productive core.`,
    },
    {
      id: "btc",
      label: "BTC holding / collateral",
      range: `${pct(a.btcHoldingCollateral.min)}–${pct(a.btcHoldingCollateral.max)}%`,
      note: "Core + tactical combined; backs USDC borrowing.",
    },
    {
      id: "stable",
      label: "Stable funding reserve",
      range: `${pct(a.stableFundingReserve.min)}–${pct(a.stableFundingReserve.max)}%`,
      note: "Funds power/ops from the cheapest source.",
    },
    {
      id: "overlay",
      label: "Yield overlay",
      range: `${pct(a.yieldOverlay.min)}–${pct(a.yieldOverlay.max)}%`,
      note: "Excess liquidity only.",
    },
  ];

  return (
    <AdminPageShell
      titleLead="BTC Mining"
      titleAccent="Performance Vault"
      contextLabel="Products · configured, not validated"
    >
      {/* Warning strip — doc §22 mandatory investor-facing notice. */}
      <AdminSectionCard ariaLabel="Status warning">
        <div className="flex items-start gap-3 border-l-2 border-[var(--ct-status-warning)] p-5">
          <span className="ct-bento-label text-[var(--ct-status-warning)]">
            Status
          </span>
          <p className="ct-metric-caption">
            Targets are not guarantees. Configured assumptions require admin
            validation before investor-facing use.
          </p>
        </div>
      </AdminSectionCard>

      {/* Thesis + targets */}
      <AdminSectionCard
        title="Thesis"
        subtitle={PRODUCT.thesis}
        ariaLabel="Thesis"
      >
        <div className="flex flex-col gap-5 p-5">
          <p className="ct-metric-caption">{brief.objective}</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Card
              material="flat"
              hoverOverlay={false}
              contentClassName="flex flex-col gap-1"
            >
              <span className="ct-bento-label">Estimated yield target</span>
              <span className="ct-metric-value tabular-nums text-[var(--ct-accent)]">
                {pct(PRODUCT.monthlyDistributionTargetAnnualized.min)}–
                {pct(PRODUCT.monthlyDistributionTargetAnnualized.max)}%
              </span>
              <span className="ct-metric-caption">
                Mining note — BTC accumulated over the ~
                {PRODUCT.targetDurationMonths}-month term with rule-based
                take-profit. Not distributed, not guaranteed.
              </span>
            </Card>
            <Card
              material="flat"
              hoverOverlay={false}
              contentClassName="flex flex-col gap-1"
            >
              <span className="ct-bento-label">Total performance target</span>
              <span className="ct-metric-value tabular-nums text-[var(--ct-accent)]">
                {pct(PRODUCT.totalPerformanceTarget.min)}–
                {pct(PRODUCT.totalPerformanceTarget.max)}%
              </span>
              <span className="ct-metric-caption">
                {pct(PRODUCT.totalPerformanceTarget.min)}–
                {pct(PRODUCT.totalPerformanceTarget.max)}% total target over ~
                {PRODUCT.targetDurationMonths} months, inclusive of the
                accumulation layer.
              </span>
            </Card>
          </div>
          <p className="ct-metric-caption italic">
            The total target is inclusive of the estimated-yield accumulation
            layer — the two bands describe the same cycle and never sum.
          </p>
        </div>
      </AdminSectionCard>

      {/* Allocation sleeves */}
      <AdminSectionCard
        title="Allocation bands"
        subtitle="Indicative regimes, not fixed weights — risk-adjusted at runtime."
        ariaLabel="Allocation bands"
      >
        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
          {sleeves.map((s) => (
            <Card
              key={s.id}
              material="flat"
              hoverOverlay={false}
              contentClassName="flex flex-col gap-1"
            >
              <span className="ct-bento-label">{s.label}</span>
              <span className="ct-metric-value tabular-nums text-[var(--ct-accent)]">
                {s.range}
              </span>
              <span className="ct-metric-caption">{s.note}</span>
            </Card>
          ))}
        </div>
      </AdminSectionCard>

      {/* Structural facts */}
      <AdminSectionCard
        title="Structure"
        subtitle="Cycle duration, mining floor, BTC collateral role, recovery — configured."
        ariaLabel="Structure"
      >
        <ul className="flex flex-col gap-2 p-5 ct-metric-caption">
          <li>
            • Target cycle:{" "}
            <span className="text-[var(--ct-text-strong)]">
              ~{PRODUCT.targetDurationMonths} months
            </span>{" "}
            (early closure on target hit).
          </li>
          <li>
            • Mining floor:{" "}
            <span className="text-[var(--ct-text-strong)]">
              {pct(a.mining.floor)}%
            </span>{" "}
            structural — sub-floor only under protection/recovery governance.
          </li>
          <li>
            • BTC holding / collateral:{" "}
            <span className="text-[var(--ct-text-strong)]">
              {pct(a.btcHoldingCollateral.min)}–{pct(a.btcHoldingCollateral.max)}%
            </span>{" "}
            (core + tactical combined).
          </li>
          <li>
            • Stable funding reserve:{" "}
            <span className="text-[var(--ct-text-strong)]">
              {pct(a.stableFundingReserve.min)}–
              {pct(a.stableFundingReserve.max)}%
            </span>{" "}
            — never auto-spent first.
          </li>
          <li>
            • Yield overlay:{" "}
            <span className="text-[var(--ct-text-strong)]">
              {pct(a.yieldOverlay.min)}–{pct(a.yieldOverlay.max)}%
            </span>{" "}
            on genuine excess liquidity only.
          </li>
          <li>
            • Recovery extension:{" "}
            <span className="text-[var(--ct-text-strong)]">
              {PRODUCT.recovery.extensionMonths.min}–
              {PRODUCT.recovery.extensionMonths.max} months
            </span>{" "}
            — Mode A ({PRODUCT.recovery.defaultMode}) default; not a guarantee of
            recovery.
          </li>
          <li>
            • Status:{" "}
            <span className="text-[var(--ct-status-warning)]">
              {PRODUCT.status} — not validated
            </span>
            .
          </li>
        </ul>
      </AdminSectionCard>
    </AdminPageShell>
  );
}
