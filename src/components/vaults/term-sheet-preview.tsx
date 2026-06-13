import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { MetricGrid } from "@/components/ui/nested-panel";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { VaultAllocationInvestorList } from "@/components/vaults/vault-allocation-display";
import { VaultLegalProofRows } from "@/components/vaults/vault-legal-proof-rows";
import { RegimeScenarioTable } from "@/components/vaults/regime-scenario-table";
import {
  VaultFlowSection,
  VaultKpiCell,
} from "@/components/vaults/vault-flow-primitives";
import { APY_DISCLAIMER_SUFFIX, MODEL_B_ONELINER } from "@/lib/constants/vault";
import type { VaultProduct } from "@/lib/data/vaults";
import { formatFeeLine, formatUsdCompact } from "@/lib/vaults/product-display";
import {
  toVaultAllocationFacts,
  toVaultLegalFacts,
} from "@/lib/vaults/vault-detail-facts";

interface TermSheetPreviewProps {
  vault: VaultProduct;
  workspace?: boolean;
}

export function TermSheetPreview({ vault, workspace = false }: TermSheetPreviewProps) {
  const aumProvenance =
    vault.currentAumUsdc > 0 ? ("live" as const) : ("manual" as const);
  const legalFacts = toVaultLegalFacts(vault);
  const allocationFacts = toVaultAllocationFacts(vault);

  if (workspace) {
    return (
      <div className="invest-flow-detail__grid">
        {/* Primary column — strategy signal */}
        <div className="invest-flow-detail__primary">
          {/* Strategy context — floats on workspace background, not a card */}
          <div>
            <p className="body-sm ct-text-muted">{MODEL_B_ONELINER}</p>
            <div className="product-doc-inline-row mt-2">
              <Badge variant="brand">Mining-backed</Badge>
              <Badge variant="default">Rule-based rebalancing</Badge>
              <Badge variant="default">Monthly USDC distributions</Badge>
            </div>
          </div>

          {/* Target allocation — DS module */}
          <Card hoverOverlay={false}>
            <p className="invest-flow-detail__panel-label">Target allocation</p>
            <VaultAllocationInvestorList facts={allocationFacts} />
          </Card>

          {/* Regime scenarios — DS module */}
          <Card hoverOverlay={false}>
            <p className="invest-flow-detail__panel-label">Regime scenarios</p>
            <RegimeScenarioTable />
            <p className="body-xs ct-text-faint mt-3">
              Conditional stress postures — not a projection of future returns · Methodology v1.0
            </p>
          </Card>
        </div>

        {/* Secondary column — support modules */}
        <div className="invest-flow-detail__secondary">
          {/* Vault metrics — compact DS module */}
          <Card hoverOverlay={false}>
            <p className="invest-flow-detail__panel-label">Vault metrics</p>
            <MetricGrid columns={2}>
              <VaultKpiCell label="Mgmt / perf">{formatFeeLine(vault.fees)}</VaultKpiCell>
              <VaultKpiCell label="Capacity">{formatUsdCompact(vault.capacityUsdc)}</VaultKpiCell>
              <VaultKpiCell label="Current AUM">
                {vault.currentAumUsdc > 0
                  ? formatUsdCompact(vault.currentAumUsdc)
                  : "Pending"}
              </VaultKpiCell>
            </MetricGrid>
            <div className="body-xs ct-text-faint mt-3 product-doc-inline-row product-doc-inline-row--dense">
              <span>Metrics:</span>
              <ProvenanceBadge kind="estimated" />
              {vault.currentAumUsdc > 0 ? <ProvenanceBadge kind={aumProvenance} /> : null}
            </div>
          </Card>

          {/* Legal & structure — compact support DS module */}
          <Card hoverOverlay={false}>
            <p className="invest-flow-detail__panel-label">Legal & structure</p>
            <div className="ct-panel-fields">
              <VaultLegalProofRows facts={legalFacts} variant="investor" />
            </div>
          </Card>

          {/* Quiet disclaimer — secondary support, not a card */}
          <p className="body-xs ct-text-faint ct-leading-relaxed">
            {vault.disclaimers} {APY_DISCLAIMER_SUFFIX}
          </p>
        </div>
      </div>
    );
  }

  // Non-workspace: original document layout preserved for other flows
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
      >
        <div className="ct-panel-fields">
          <VaultLegalProofRows facts={legalFacts} variant="investor" />
        </div>
      </VaultFlowSection>
    </div>
  );
}
