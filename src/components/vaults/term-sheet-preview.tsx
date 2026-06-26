import { Card } from "@/components/ui/card";
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

/** LP term sheet body for step 2 (`/vaults/[id]`). Flat sections — one surface level. */
export function TermSheetPreview({ vault }: TermSheetPreviewProps) {
  const aumProvenance =
    vault.currentAumUsdc > 0 ? ("live" as const) : ("manual" as const);
  const legalFacts = toVaultLegalFacts(vault);
  const allocationFacts = toVaultAllocationFacts(vault);

  return (
    <div className="invest-flow-detail__grid">
      <div className="invest-flow-detail__primary">
        <Card
          role="region"
          aria-label="Target allocation"
          hoverOverlay={false}
          className="vault-detail-block"
          contentClassName="vault-detail-block__content"
        >
          <header className="vault-detail-block__header">
            <h2 className="h2">Target allocation</h2>
          </header>
          <VaultAllocationInvestorList facts={allocationFacts} />
        </Card>

        <Card
          role="region"
          aria-label="Regime scenarios"
          hoverOverlay={false}
          className="vault-detail-block"
          contentClassName="vault-detail-block__content"
        >
          <header className="vault-detail-block__header">
            <h2 className="h2">Regime scenarios</h2>
          </header>
          <RegimeScenarioTable vault={vault} />
          <p className="body-xs ct-text-faint vault-regime-note">
            Conditional stress postures — not a projection of future returns · Methodology v1.0
          </p>
        </Card>
      </div>

      <div className="invest-flow-detail__secondary">
        <Card
          role="region"
          aria-label="Vault metrics"
          hoverOverlay={false}
          className="vault-detail-block"
          contentClassName="vault-detail-block__content"
        >
          <header className="vault-detail-block__header vault-detail-block__header--split">
            <h2 className="h2">Vault metrics</h2>
            <div className="flex shrink-0 items-center gap-(--ct-space-2)">
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
        </Card>

        <Card
          role="region"
          aria-label="Legal and structure"
          hoverOverlay={false}
          className="vault-detail-block"
          contentClassName="vault-detail-block__content"
        >
          <header className="vault-detail-block__header">
            <h2 className="h2">Legal &amp; structure</h2>
          </header>
          <div className="ct-panel-fields">
            <VaultLegalProofRows facts={legalFacts} variant="investor" />
          </div>
        </Card>

        <p className="body-xs ct-text-faint ct-leading-relaxed vault-detail-disclaimer">
          {vault.disclaimers} {APY_DISCLAIMER_SUFFIX}
        </p>
      </div>
    </div>
  );
}
