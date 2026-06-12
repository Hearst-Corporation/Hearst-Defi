import { Badge } from "@/components/ui/badge";
import { NestedKpiGrid, ProofRow } from "@/components/ui/nested-panel";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { RegimeScenarioTable } from "@/components/vaults/regime-scenario-table";
import {
  VaultFlowSection,
  VaultKpiCell,
} from "@/components/vaults/vault-flow-primitives";
import { allocationDashToneFor } from "@/lib/allocation-colors";
import {
  MODEL_B_ONELINER,
  REG_LABELS_LONG,
  SPV_LABELS_LONG,
} from "@/lib/constants/vault";
import { cn } from "@/lib/cn";
import type { VaultProduct } from "@/lib/data/vaults";
import type { AllocationBucket } from "@/lib/engine/types";
import { formatFeeLine, formatUsdCompact } from "@/lib/vaults/product-display";

const ALLOCATION_DESCRIPTIONS: Record<AllocationBucket, string> = {
  mining:
    "Directly deployed hashrate — revenue share from partner mining facilities.",
  btc_tactical:
    "Spot BTC exposure for directional upside within a realised-volatility guardrail.",
  usdc_base: "T-bills + on-chain lending weighted average.",
  stable_reserve: "USDC yield buffer for soft lock-up and redemption queue.",
};

const ALLOCATION_BUCKETS: AllocationBucket[] = [
  "mining",
  "btc_tactical",
  "usdc_base",
  "stable_reserve",
];

function allocationBps(vault: VaultProduct, bucket: AllocationBucket): number {
  switch (bucket) {
    case "mining":
      return vault.targetMiningBps;
    case "btc_tactical":
      return vault.targetBtcTacticalBps;
    case "usdc_base":
      return vault.targetUsdcBaseBps;
    case "stable_reserve":
      return vault.targetStableReserveBps;
  }
}

const ALLOCATION_LABELS: Record<AllocationBucket, string> = {
  mining: "Bitcoin Mining Operations",
  btc_tactical: "BTC Tactical Delta",
  usdc_base: "USDC Base Lending",
  stable_reserve: "Stable Reserve",
};

function AllocationTargetRow({
  bucket,
  bps,
}: {
  bucket: AllocationBucket;
  bps: number;
}) {
  const dotTone = allocationDashToneFor(bucket);

  return (
    <div className="vault-allocation-row">
      <span
        aria-hidden
        className={cn("dash-legend-dot mt-1 shrink-0", `dot-${dotTone}`)}
      />
      <div className="vault-allocation-row__body">
        <div className="min-w-0">
          <p className="body-sm font-semibold ct-text-primary">
            {ALLOCATION_LABELS[bucket]}
          </p>
          <p className="body-xs ct-text-muted mt-0.5">
            {ALLOCATION_DESCRIPTIONS[bucket]}
          </p>
        </div>
        <span className="h4 tabular mono ct-text-strong shrink-0">
          {(bps / 100).toFixed(0)}%
        </span>
      </div>
    </div>
  );
}

interface TermSheetPreviewProps {
  vault: VaultProduct;
}

export function TermSheetPreview({ vault }: TermSheetPreviewProps) {
  const aumProvenance =
    vault.currentAumUsdc > 0 ? ("live" as const) : ("manual" as const);

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
        <div className="product-doc-stack--tight">
          <NestedKpiGrid columns={3}>
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
          </NestedKpiGrid>
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
            <div>
              {ALLOCATION_BUCKETS.map((bucket) => (
                <AllocationTargetRow
                  key={bucket}
                  bucket={bucket}
                  bps={allocationBps(vault, bucket)}
                />
              ))}
            </div>
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
          <ProofRow label="SPV structure">
            {SPV_LABELS_LONG[vault.spvJurisdiction] ?? vault.spvJurisdiction}
          </ProofRow>
          <ProofRow label="Share class">{`Class ${vault.shareClass}`}</ProofRow>
          <ProofRow label="Regulatory exemption">
            {REG_LABELS_LONG[vault.regExemption] ?? vault.regExemption}
          </ProofRow>
          <ProofRow label="Custodian">Custody configuration pending</ProofRow>
          <ProofRow label="Multisig threshold">Multisig approval required</ProofRow>
          <ProofRow label="Audit">Spearbit · scheduled</ProofRow>
        </div>
      </VaultFlowSection>
    </div>
  );
}
