import { AwaitingMetricState } from "@/components/portfolio/awaiting-metric-state";
import {
  MINING_CASHFLOW_COPY,
  miningCashflowAwaitingState,
} from "@/components/proof/empty-messages";
import { Card } from "@/components/ui/card";
import { Metric } from "@/components/ui/metric";
import { NestedKpiGrid } from "@/components/ui/nested-panel";
import { DashboardPanelHeader } from "@/components/ui/dashboard-panel-header";
import type { CoverageView } from "@/lib/engine/coverage-view";

const BADGE: Record<CoverageView["provenance"], "live" | "estimated" | "manual" | "stale"> = {
  live: "live",
  estimated: "estimated",
  pending: "manual",
  invalid: "stale",
};

export function MiningCashFlowEvidence({
  coverage,
}: {
  coverage?: CoverageView | null;
}) {
  const provenance = coverage?.provenance ?? "pending";

  if (provenance === "pending" || provenance === "invalid") {
    return <AwaitingMetricState {...miningCashflowAwaitingState(provenance)} />;
  }

  const ratioLabel =
    coverage?.ratio !== null && coverage?.ratio !== undefined
      ? `${coverage.ratio.toFixed(2)}×`
      : "Pending";

  return (
    <Card>
      <DashboardPanelHeader
        eyebrow="Mining cash-flow evidence"
        title="Yield source — Bitcoin mining revenue"
        provenance={BADGE[provenance]}
        tone="primary"
      />

      <p className="body-sm mb-4">{MINING_CASHFLOW_COPY[provenance]}</p>

      <NestedKpiGrid columns={4}>
        <Metric
          variant="nested"
          label="Distribution coverage"
          value={ratioLabel}
          sublabel="net mining cash ÷ target"
        />
        <Metric
          variant="nested"
          label="State"
          value={coverage?.state ?? "invalid"}
          sublabel={coverage?.recommendation.action ?? "—"}
        />
        <Metric
          variant="nested"
          label="Latest revenue period"
          value={coverage?.period ?? "—"}
          sublabel={coverage?.lastUpdated ? "as of attestation" : "awaiting first close"}
        />
        <Metric
          variant="nested"
          label="Attestation status"
          value={provenance === "live" ? "Attested" : "Pending"}
          sublabel="mining partner + pool"
        />
      </NestedKpiGrid>
    </Card>
  );
}
