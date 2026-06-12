import { Badge } from "@/components/ui/badge";
import { MetricGrid } from "@/components/ui/nested-panel";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { VaultAllocationInvestorList } from "@/components/vaults/vault-allocation-display";
import { VaultLegalProofRows } from "@/components/vaults/vault-legal-proof-rows";
import { RegimeScenarioTable } from "@/components/vaults/regime-scenario-table";
import {
  VaultFlowSection,
  VaultKpiCell,
} from "@/components/vaults/vault-flow-primitives";
import { MODEL_B_ONELINER } from "@/lib/constants/vault";
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
    <div className="product-doc-stack">
      <VaultFlowSection
        id="sec-glance"
        title="At a glance"
        provenance={
          <div className="body-xs ct-text-faint product-doc-inline-row product-doc-inline-row--dense">
            <span>Metrics:</span>
            <ProvenanceBadge kind="estimated" />
            <ProvenanceBadge kind="manual" />
            {vault.currentAumUsdc > 0 ? (
              <ProvenanceBadge kind={aumProvenance} />
            ) : null}
          </div>
        }
      >
        <div className="product-doc-stack product-doc-stack--tight">
          <MetricGrid columns={3}>
            <VaultKpiCell label="Management / performance">
              {formatFeeLine(vault.fees)}
            </VaultKpiCell>
            <VaultKpiCell label="Vault capacity">
              {formatUsdCompact(vault.capacityUsdc)}
            </VaultKpiCell>
            <VaultKpiCell label="Current AUM">
              {vault.currentAumUsdc > 0
                ? formatUsdCompact(vault.currentAumUsdc)
                : "Pending snapshot"}
            </VaultKpiCell>
          </MetricGrid>
          <p className="body-xs ct-text-faint border-t ct-bc-soft pt-4">
            Distribution coverage pending first attested mining period ·
            Indicative cadence (monthly, T+5) · Methodology v1.0 active
          </p>
        </div>
      </VaultFlowSection>

      <VaultFlowSection
        id="sec-strategy-allocation"
        title="Strategy & allocation"
        provenance={
          <div className="body-xs ct-text-faint product-doc-inline-row product-doc-inline-row--dense">
            <span>Methodology:</span>
            <ProvenanceBadge kind="manual" />
            <span>Scenarios:</span>
            <ProvenanceBadge kind="estimated" />
          </div>
        }
      >
        <div className="product-doc-stack">
          <div className="product-doc-section">
            <p className="body-sm ct-text-muted">{MODEL_B_ONELINER}</p>
            <div className="product-doc-inline-row">
              <Badge variant="brand">Mining-backed</Badge>
              <Badge variant="default">Rule-based rebalancing</Badge>
              <Badge variant="default">Monthly USDC distributions</Badge>
            </div>
          </div>

          <div>
            <h3 className="h3 mb-2">Target allocation</h3>
            <VaultAllocationInvestorList facts={allocationFacts} />
          </div>

          <div>
            <h3 className="h3 mb-2">Regime scenarios</h3>
            <p className="body-xs ct-text-muted mb-3 ct-prose-lg">
              Stress postures from Methodology v1.0 (Bull / Bear). Base case =
              target allocation above. Conditional — not a projection of future
              returns.
            </p>
            <RegimeScenarioTable />
          </div>

          <p className="body-xs ct-text-faint border-t ct-bc-soft pt-2">
            Projections follow Methodology{" "}
            <span className="mono">v1.0</span> — weighted buckets with ±10–30%
            assumption risk factors. APY is always shown as a range, never a
            point estimate. Results are not projected and are subject to change.
          </p>
        </div>
      </VaultFlowSection>

      <VaultFlowSection
        id="sec-legal"
        title="Legal & risk"
        provenance={<ProvenanceBadge kind="manual" />}
        className="opacity-95"
      >
        <div className="ct-panel-fields">
          <VaultLegalProofRows facts={legalFacts} variant="investor" />
        </div>
      </VaultFlowSection>
    </div>
  );
}
