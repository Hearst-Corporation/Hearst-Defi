import { BentoHeader, BentoKpiTile } from "@/components/catalyst/bento";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { VaultAllocationInvestorList } from "@/components/vaults/vault-allocation-display";
import { VaultLegalProofRows } from "@/components/vaults/vault-legal-proof-rows";
import { RegimeScenarioTable } from "@/components/vaults/regime-scenario-table";
import {
  APY_DISCLAIMER_SUFFIX,
  AUM_PENDING_LABEL,
  RISK_LABELS,
  STRATEGY_LABELS,
} from "@/lib/constants/vault";
import type { VaultProduct } from "@/lib/data/vaults";
import {
  formatFeeLine,
  formatMinTicketUsdc,
  formatUsdCompact,
} from "@/lib/vaults/product-display";
import {
  toVaultAllocationFacts,
  toVaultLegalFacts,
} from "@/lib/vaults/vault-detail-facts";

interface TermSheetPreviewProps {
  vault: VaultProduct;
}

/** KPI tile fill — matches the Portfolio canon (gap-px grid + per-tile surface). */
const TERM_TILE = "bg-surface-inset md:px-6";

/** LP term sheet body for step 2 (`/vaults/[id]`). Pure Tailwind bento — matches the Portfolio page. */
export function TermSheetPreview({ vault }: TermSheetPreviewProps) {
  // AUM comes from a VaultSnapshot aggregate (seed/computed), NOT a live
  // on-chain read — so it is "estimated", never "live". The "Risk & Provenance"
  // panel surfaces this sourcing once; the headline grid carries the value.
  const legalFacts = toVaultLegalFacts(vault);
  const allocationFacts = toVaultAllocationFacts(vault);
  const strategyLabel = STRATEGY_LABELS[vault.strategy] ?? vault.strategy;

  return (
    <div className="dark flex flex-col gap-y-5">
      {/* HEADLINE TERM TILES */}
      <section className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-sm overflow-hidden flex flex-col">
        <BentoHeader
          title="Term Sheet"
          subtitle={`${vault.ticker} · ${strategyLabel}`}
          trailing={<ProvenanceBadge kind="estimated" variant="compact" />}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-px bg-[var(--ct-border-soft)]">
          <BentoKpiTile
            label="Target APY"
            accent
            value={
              <span className="flex items-baseline gap-1.5">
                {vault.apyLow.toFixed(1)}
                <span className="text-base text-[var(--ct-text-muted)] font-normal mx-0.5">
                  —
                </span>
                {vault.apyHigh.toFixed(1)}
                <span className="text-base text-[var(--ct-text-muted)] font-normal">%</span>
              </span>
            }
            sub="Target projection — not guaranteed"
            className={TERM_TILE}
          />
          <BentoKpiTile
            label="Min Ticket"
            value={formatMinTicketUsdc(vault.minTicketUsdc)}
            sub="USDC"
            className={TERM_TILE}
          />
          <BentoKpiTile
            label="Soft Lock-up"
            value={`${vault.softLockupDays}d`}
            sub="Redemption queue"
            className={TERM_TILE}
          />
          <BentoKpiTile
            label="Mgmt / Perf"
            value={formatFeeLine(vault.fees)}
            sub="Fee schedule"
            className={TERM_TILE}
          />
          <BentoKpiTile
            label="Capacity"
            value={formatUsdCompact(vault.capacityUsdc)}
            sub="Hard cap"
            className={TERM_TILE}
          />
          <BentoKpiTile
            label="Current AUM"
            value={
              vault.currentAumUsdc > 0
                ? formatUsdCompact(vault.currentAumUsdc)
                : AUM_PENDING_LABEL
            }
            sub={
              vault.currentAumUsdc > 0
                ? "Estimated — snapshot aggregate"
                : "No capital yet"
            }
            className={TERM_TILE}
          />
        </div>
      </section>

      {/* TARGET ALLOCATION */}
      <section className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-sm overflow-hidden flex flex-col">
        <BentoHeader
          title="Target Allocation"
          subtitle="Sleeve mix at inception"
        />
        <div className="p-6">
          <VaultAllocationInvestorList facts={allocationFacts} />
        </div>
      </section>

      {/* REGIME SCENARIOS */}
      <section className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-sm overflow-hidden flex flex-col">
        <BentoHeader
          title="Regime Scenarios"
          subtitle="Conditional stress postures · Methodology v1.0"
        />
        <RegimeScenarioTable vault={vault} />
        <div className="px-5 pb-5">
          <div className="flex items-center gap-2 ct-bento-label">
            <div className="size-1 bg-[var(--ct-text-faint)] rounded-full" />
            Conditional stress postures — not a projection of future returns
          </div>
        </div>
      </section>

      {/* LEGAL & STRUCTURE */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-sm overflow-hidden flex flex-col">
          <BentoHeader title="Legal &amp; Structure" subtitle="SPV terms" />
          <div className="p-6 flex flex-col gap-3">
            <VaultLegalProofRows facts={legalFacts} variant="investor" />
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-sm overflow-hidden flex flex-col">
          <BentoHeader
            title="Risk &amp; Provenance"
            subtitle="Risk band · data sourcing"
            trailing={<ProvenanceBadge kind="estimated" variant="compact" />}
          />
          <div className="grid grid-cols-2 gap-px bg-[var(--ct-border-soft)]">
            <BentoKpiTile
              label="Risk Level"
              value={RISK_LABELS[vault.riskLevel]}
              sub="Methodology band"
              className={TERM_TILE}
            />
            <BentoKpiTile
              label="AUM Sourcing"
              value={vault.currentAumUsdc > 0 ? "Estimated" : AUM_PENDING_LABEL}
              sub={
                vault.currentAumUsdc > 0
                  ? "Snapshot aggregate — not on-chain"
                  : "No capital yet"
              }
              className={TERM_TILE}
            />
          </div>
        </div>
      </section>

      {/* DISCLAIMER */}
      <p className="ct-metric-caption leading-relaxed">
        {vault.disclaimers} {APY_DISCLAIMER_SUFFIX}
      </p>
    </div>
  );
}
