
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
        <section className="vault-detail-block">
          <header className="invest-flow-card-header mb-0">
            <h3 className="h3 ct-text-strong ct-drop-glow-subtle">Target allocation</h3>
          </header>
          <VaultAllocationInvestorList facts={allocationFacts} />
        </section>

        <section className="vault-detail-block">
          <header className="invest-flow-card-header mb-0">
            <h3 className="h3 ct-text-strong ct-drop-glow-subtle">Regime scenarios</h3>
          </header>
          <RegimeScenarioTable vault={vault} />
          <p className="body-xs ct-text-faint vault-regime-note">
            Conditional stress postures — not a projection of future returns · Methodology v1.0
          </p>
        </section>
      </div>

      <div className="invest-flow-detail__secondary">
        <section className="vault-detail-block">
          <header className="invest-flow-card-header mb-0">
            <h3 className="h3 ct-text-strong ct-drop-glow-subtle">Vault metrics</h3>
            <div className="flex shrink-0 items-center gap-[var(--ct-space-1_5)]">
              <ProvenanceBadge kind="estimated" variant="compact" />
              {vault.currentAumUsdc > 0 ? (
                <ProvenanceBadge kind={aumProvenance} variant="compact" />
              ) : null}
            </div>
          </header>
          <MetricGrid columns={2}>
            <VaultKpiCell label="Mgmt / perf">{formatFeeLine(vault.fees)}</VaultKpiCell>
            <VaultKpiCell label="Capacity">{formatUsdCompact(vault.capacityUsdc)}</VaultKpiCell>
            <VaultKpiCell label="Current AUM">
              {vault.currentAumUsdc > 0
                ? formatUsdCompact(vault.currentAumUsdc)
                : "Pending"}
            </VaultKpiCell>
          </MetricGrid>
        </section>

        <section className="vault-detail-block">
          <header className="invest-flow-card-header mb-0">
            <h3 className="h3 ct-text-strong ct-drop-glow-subtle">Legal &amp; structure</h3>
          </header>
          <div className="ct-panel-fields">
            <VaultLegalProofRows facts={legalFacts} variant="investor" />
          </div>
        </section>

        <p className="body-xs ct-text-faint ct-leading-relaxed">
          {vault.disclaimers} {APY_DISCLAIMER_SUFFIX}
        </p>
      </div>
    </div>
  );
}
