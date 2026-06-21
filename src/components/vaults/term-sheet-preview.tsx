
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
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

/** LP term sheet body for step 2 (`/vaults/[id]`). Workspace grid only. */
export function TermSheetPreview({ vault }: TermSheetPreviewProps) {
  const aumProvenance =
    vault.currentAumUsdc > 0 ? ("live" as const) : ("manual" as const);
  const legalFacts = toVaultLegalFacts(vault);
  const allocationFacts = toVaultAllocationFacts(vault);

  return (
    <div className="invest-flow-detail__grid">
      <div className="invest-flow-detail__primary">
        <Card hoverOverlay={false}>
          <CardHeader className="invest-flow-card-header mb-0">
            <CardTitle>Target allocation</CardTitle>
          </CardHeader>
          <VaultAllocationInvestorList facts={allocationFacts} />
        </Card>

        <Card hoverOverlay={false}>
          <CardHeader className="invest-flow-card-header mb-0">
            <CardTitle>Regime scenarios</CardTitle>
          </CardHeader>
          <RegimeScenarioTable vault={vault} />
          <p className="body-xs ct-text-faint vault-regime-note">
            Conditional stress postures — not a projection of future returns · Methodology v1.0
          </p>
        </Card>
      </div>

      <div className="invest-flow-detail__secondary">
        <Card hoverOverlay={false}>
          <CardHeader className="invest-flow-card-header mb-0">
            <CardTitle>Vault metrics</CardTitle>
            <div className="flex shrink-0 items-center gap-1.5">
              <ProvenanceBadge kind="estimated" variant="compact" />
              {vault.currentAumUsdc > 0 ? (
                <ProvenanceBadge kind={aumProvenance} variant="compact" />
              ) : null}
            </div>
          </CardHeader>
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

        <Card hoverOverlay={false}>
          <CardHeader className="invest-flow-card-header mb-0">
            <CardTitle>Legal & structure</CardTitle>
          </CardHeader>
          <div className="ct-panel-fields">
            <VaultLegalProofRows facts={legalFacts} variant="investor" />
          </div>
        </Card>

        <p className="body-xs ct-text-faint ct-leading-relaxed">
          {vault.disclaimers} {APY_DISCLAIMER_SUFFIX}
        </p>
      </div>
    </div>
  );
}
