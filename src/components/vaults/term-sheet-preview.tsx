
import { MetricGrid } from "@/components/ui/nested-panel";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { VaultAllocationInvestorList } from "@/components/vaults/vault-allocation-display";
import { VaultLegalProofRows } from "@/components/vaults/vault-legal-proof-rows";
import { RegimeScenarioTable } from "@/components/vaults/regime-scenario-table";
import { VaultKpiCell } from "@/components/vaults/vault-flow-primitives";
import { APY_DISCLAIMER_SUFFIX } from "@/lib/constants/vault";
import type { VaultProduct } from "@/lib/data/vaults";
import { formatFeeLine, formatUsdCompact } from "@/lib/vaults/product-display";
import {
  toVaultAllocationFacts,
  toVaultLegalFacts,
} from "@/lib/vaults/vault-detail-facts";

interface TermSheetPreviewProps {
  vault: VaultProduct;
}

export function TermSheetPreview({ vault }: TermSheetPreviewProps) {
  const aumProvenance =
    vault.currentAumUsdc > 0 ? ("live" as const) : ("manual" as const);
  const legalFacts = toVaultLegalFacts(vault);
  const allocationFacts = toVaultAllocationFacts(vault);

  return (
    <div className="invest-flow-detail__grid">
      <div className="invest-flow-detail__primary">
        <section className="vault-detail-block" aria-label="Target allocation">
          <header className="invest-flow-card-header">
            <div className="flex items-center justify-between gap-(--ct-space-4)">
              <h3 className="h3 ct-text-strong ct-drop-glow-subtle">Target allocation</h3>
              <span className="text-(--ct-text-nano) uppercase tracking-widest ct-text-faint font-bold">
                Portfolio Strategy
              </span>
            </div>
          </header>
          <VaultAllocationInvestorList facts={allocationFacts} />
        </section>

        <section className="vault-detail-block" aria-label="Regime scenarios">
          <header className="invest-flow-card-header">
            <div className="flex items-center justify-between gap-(--ct-space-4)">
              <h3 className="h3 ct-text-strong ct-drop-glow-subtle">Regime scenarios</h3>
              <span className="text-(--ct-text-nano) uppercase tracking-widest ct-text-faint font-bold">
                Stress Testing
              </span>
            </div>
          </header>
          <RegimeScenarioTable vault={vault} />
          <p className="body-xs ct-text-faint vault-regime-note">
            Conditional stress postures — not a projection of future returns · Methodology v1.0
          </p>
        </section>
      </div>

      <div className="invest-flow-detail__secondary">
        <section className="vault-detail-block" aria-label="Vault metrics">
          <header className="invest-flow-card-header">
            <div className="flex flex-col gap-(--ct-space-1)">
              <div className="flex items-center justify-between">
                <h3 className="h3 ct-text-strong">Vault metrics</h3>
                <span className="text-(--ct-text-nano) uppercase tracking-widest ct-text-faint font-bold">
                  Performance
                </span>
              </div>
              <div className="flex items-center gap-(--ct-space-2)">
                <ProvenanceBadge kind="estimated" variant="compact" />
                {vault.currentAumUsdc > 0 ? (
                  <ProvenanceBadge kind={aumProvenance} variant="compact" />
                ) : null}
              </div>
            </div>
          </header>
          <div className="ct-nested-panel p-(--ct-space-5) border border-(--ct-border-ghost) bg-(--ct-surface-1)">
            <MetricGrid columns={2} className="gap-y-(--ct-space-6)">
              <VaultKpiCell label="Mgmt / perf" valueClassName="text-xl">
                {formatFeeLine(vault.fees)}
              </VaultKpiCell>
              <VaultKpiCell label="Capacity" valueClassName="text-xl">
                {formatUsdCompact(vault.capacityUsdc)}
              </VaultKpiCell>
              <VaultKpiCell label="Current AUM" valueClassName="text-xl">
                {vault.currentAumUsdc > 0
                  ? formatUsdCompact(vault.currentAumUsdc)
                  : "Pending"}
              </VaultKpiCell>
            </MetricGrid>
          </div>
        </section>

        <section className="vault-detail-block" aria-label="Legal and structure">
          <header className="invest-flow-card-header">
            <div className="flex items-center justify-between">
              <h3 className="h3 ct-text-strong">Legal &amp; structure</h3>
              <span className="text-(--ct-text-nano) uppercase tracking-widest ct-text-faint font-bold">
                Compliance
              </span>
            </div>
          </header>
          <div className="ct-nested-panel p-(--ct-space-2) border border-(--ct-border-ghost) bg-(--ct-surface-1)">
            <VaultLegalProofRows facts={legalFacts} variant="investor" />
          </div>
        </section>

        <div className="mt-(--ct-space-8) pt-(--ct-space-6) border-t border-(--ct-border-ghost)">
          <p className="body-xs ct-text-faint ct-leading-relaxed italic">
            {vault.disclaimers} {APY_DISCLAIMER_SUFFIX}
          </p>
        </div>
      </div>
    </div>
  );
}
