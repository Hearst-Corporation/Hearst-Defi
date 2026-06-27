import type { ReactNode } from "react";

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

/** A single term tile in the headline metric band (Portfolio "Status Tile" style). */
function TermTile({
  label,
  value,
  sub,
  accent = false,
  className,
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  accent?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-2 p-5 md:px-6 ${className ?? ""}`}>
      <div className="text-[10px] uppercase tracking-[0.15em] font-bold text-zinc-500">
        {label}
      </div>
      <div
        className={`text-[18px] font-medium leading-none tracking-tight tabular-nums ${
          accent ? "text-[#A7FB90]" : "text-white"
        }`}
      >
        {value}
      </div>
      {sub ? (
        <div className="text-[10px] text-zinc-500 tracking-wide">{sub}</div>
      ) : null}
    </div>
  );
}

/** Section header in the Portfolio bento style. */
function SectionHeader({
  title,
  subtitle,
  trailing,
}: {
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between p-5 border-b border-white/5">
      <div className="flex flex-col gap-1.5">
        <h2 className="text-[11px] font-bold text-zinc-400 uppercase tracking-[0.15em] leading-none">
          {title}
        </h2>
        {subtitle ? (
          <p className="text-[12px] text-zinc-500 tracking-wide">{subtitle}</p>
        ) : null}
      </div>
      {trailing ? (
        <div className="flex shrink-0 items-center gap-2 pb-0.5">{trailing}</div>
      ) : null}
    </div>
  );
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
        <SectionHeader
          title="Term Sheet"
          subtitle={`${vault.ticker} · ${strategyLabel}`}
          trailing={<ProvenanceBadge kind="estimated" variant="compact" />}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 bg-[#15191C]">
          <TermTile
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
            className="border-b border-white/5 sm:border-r md:border-b-0"
          />
          <TermTile
            label="Min Ticket"
            value={formatMinTicketUsdc(vault.minTicketUsdc)}
            sub="USDC"
            className="border-b border-white/5 md:border-r"
          />
          <TermTile
            label="Soft Lock-up"
            value={`${vault.softLockupDays}d`}
            sub="Redemption queue"
            className="border-b border-white/5 sm:border-r sm:border-b-0 md:border-r-0"
          />
          <TermTile
            label="Mgmt / Perf"
            value={formatFeeLine(vault.fees)}
            sub="Fee schedule"
            className="border-b border-white/5 sm:border-r md:border-b-0"
          />
          <TermTile
            label="Capacity"
            value={formatUsdCompact(vault.capacityUsdc)}
            sub="Hard cap"
            className="border-b border-white/5 sm:border-b-0 md:border-r"
          />
          <TermTile
            label="Current AUM"
            value={
              vault.currentAumUsdc > 0
                ? formatUsdCompact(vault.currentAumUsdc)
                : "Pending"
            }
            sub={RISK_LABELS[vault.riskLevel]}
          />
        </div>
      </section>

      {/* TARGET ALLOCATION */}
      <section className="rounded-2xl border border-white/10 bg-black shadow-sm overflow-hidden flex flex-col">
        <SectionHeader
          title="Target Allocation"
          subtitle="Sleeve mix at inception"
        />
        <div className="p-6">
          <VaultAllocationInvestorList facts={allocationFacts} />
        </div>
      </section>

      {/* REGIME SCENARIOS */}
      <section className="rounded-2xl border border-white/10 bg-black shadow-sm overflow-hidden flex flex-col">
        <SectionHeader
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
          <SectionHeader title="Legal &amp; Structure" subtitle="SPV terms" />
          <div className="p-6 flex flex-col gap-3">
            <VaultLegalProofRows facts={legalFacts} variant="investor" />
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black shadow-sm overflow-hidden flex flex-col">
          <SectionHeader
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
            <TermTile
              label="Mgmt / Perf"
              value={formatFeeLine(vault.fees)}
              className="border-b border-r border-white/5"
            />
            <TermTile
              label="Capacity"
              value={formatUsdCompact(vault.capacityUsdc)}
              className="border-b border-white/5"
            />
            <TermTile
              label="Current AUM"
              value={
                vault.currentAumUsdc > 0
                  ? formatUsdCompact(vault.currentAumUsdc)
                  : "Pending"
              }
              className="border-r border-white/5"
            />
            <TermTile label="Risk Level" value={RISK_LABELS[vault.riskLevel]} />
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
