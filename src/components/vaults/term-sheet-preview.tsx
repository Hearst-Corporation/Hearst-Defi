import { BentoHeader, BentoKpiTile } from "@/components/ui/bento";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { VaultAllocationInvestorList } from "@/components/vaults/vault-allocation-display";
import { VaultLegalProofRows } from "@/components/vaults/vault-legal-proof-rows";
import { RegimeScenarioTable } from "@/components/vaults/regime-scenario-table";
import {
  APY_DISCLAIMER_SUFFIX,
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

/** LP term sheet body for step 2 (`/vaults/[id]`). Pure Tailwind bento — matches the Portfolio page. */
export function TermSheetPreview({ vault }: TermSheetPreviewProps) {
  const aumProvenance =
    vault.currentAumUsdc > 0 ? ("live" as const) : ("manual" as const);
  const legalFacts = toVaultLegalFacts(vault);
  const allocationFacts = toVaultAllocationFacts(vault);
  const strategyLabel = STRATEGY_LABELS[vault.strategy] ?? vault.strategy;

  return (
    <div className="dark flex flex-col gap-y-5">
      {/* HEADLINE TERM TILES */}
      <section className="rounded-2xl border border-white/10 bg-black shadow-sm overflow-hidden flex flex-col">
        <BentoHeader
          title="Term Sheet"
          subtitle={`${vault.ticker} · ${strategyLabel}`}
          trailing={<ProvenanceBadge kind="estimated" variant="compact" />}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 bg-[#15191C]">
          <BentoKpiTile
            label="Target APY"
            accent
            value={
              <span className="flex items-baseline gap-1.5">
                {vault.apyLow.toFixed(1)}
                <span className="text-base text-zinc-500 font-normal mx-0.5">
                  —
                </span>
                {vault.apyHigh.toFixed(1)}
                <span className="text-base text-zinc-500 font-normal">%</span>
              </span>
            }
            sub="Target projection — not guaranteed"
            className="md:px-6 border-b border-white/5 sm:border-r md:border-b-0"
          />
          <BentoKpiTile
            label="Min Ticket"
            value={formatMinTicketUsdc(vault.minTicketUsdc)}
            sub="USDC"
            className="md:px-6 border-b border-white/5 md:border-r"
          />
          <BentoKpiTile
            label="Soft Lock-up"
            value={`${vault.softLockupDays}d`}
            sub="Redemption queue"
            className="md:px-6 border-b border-white/5 sm:border-r sm:border-b-0 md:border-r-0"
          />
          <BentoKpiTile
            label="Mgmt / Perf"
            value={formatFeeLine(vault.fees)}
            sub="Fee schedule"
            className="md:px-6 border-b border-white/5 sm:border-r md:border-b-0"
          />
          <BentoKpiTile
            label="Capacity"
            value={formatUsdCompact(vault.capacityUsdc)}
            sub="Hard cap"
            className="md:px-6 border-b border-white/5 sm:border-b-0 md:border-r"
          />
          <BentoKpiTile
            label="Current AUM"
            value={
              vault.currentAumUsdc > 0
                ? formatUsdCompact(vault.currentAumUsdc)
                : "Pending"
            }
            sub={RISK_LABELS[vault.riskLevel]}
            className="md:px-6"
          />
        </div>
      </section>

      {/* TARGET ALLOCATION */}
      <section className="rounded-2xl border border-white/10 bg-black shadow-sm overflow-hidden flex flex-col">
        <BentoHeader
          title="Target Allocation"
          subtitle="Sleeve mix at inception"
        />
        <div className="p-6">
          <VaultAllocationInvestorList facts={allocationFacts} />
        </div>
      </section>

      {/* REGIME SCENARIOS */}
      <section className="rounded-2xl border border-white/10 bg-black shadow-sm overflow-hidden flex flex-col">
        <BentoHeader
          title="Regime Scenarios"
          subtitle="Conditional stress postures · Methodology v1.0"
        />
        <RegimeScenarioTable vault={vault} />
        <div className="px-5 pb-5">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.1em] text-zinc-500">
            <div className="size-1 bg-zinc-500 rounded-full" />
            Conditional stress postures — not a projection of future returns
          </div>
        </div>
      </section>

      {/* LEGAL & STRUCTURE */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="rounded-2xl border border-white/10 bg-black shadow-sm overflow-hidden flex flex-col">
          <BentoHeader title="Legal &amp; Structure" subtitle="SPV terms" />
          <div className="p-6 flex flex-col gap-3">
            <VaultLegalProofRows facts={legalFacts} variant="investor" />
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black shadow-sm overflow-hidden flex flex-col">
          <BentoHeader
            title="Vault Metrics"
            subtitle="Fees · capacity · AUM"
            trailing={
              <>
                <ProvenanceBadge kind="estimated" variant="compact" />
                {vault.currentAumUsdc > 0 ? (
                  <ProvenanceBadge kind={aumProvenance} variant="compact" />
                ) : null}
              </>
            }
          />
          <div className="grid grid-cols-2 bg-[#15191C]">
            <BentoKpiTile
              label="Mgmt / Perf"
              value={formatFeeLine(vault.fees)}
              className="md:px-6 border-b border-r border-white/5"
            />
            <BentoKpiTile
              label="Capacity"
              value={formatUsdCompact(vault.capacityUsdc)}
              className="md:px-6 border-b border-white/5"
            />
            <BentoKpiTile
              label="Current AUM"
              value={
                vault.currentAumUsdc > 0
                  ? formatUsdCompact(vault.currentAumUsdc)
                  : "Pending"
              }
              className="md:px-6 border-r border-white/5"
            />
            <BentoKpiTile
              label="Risk Level"
              value={RISK_LABELS[vault.riskLevel]}
              className="md:px-6"
            />
          </div>
        </div>
      </section>

      {/* DISCLAIMER */}
      <p className="text-[12px] text-zinc-500 leading-relaxed">
        {vault.disclaimers} {APY_DISCLAIMER_SUFFIX}
      </p>
    </div>
  );
}
