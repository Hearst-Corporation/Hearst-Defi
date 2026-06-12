import { AwaitingMetricState } from "@/components/portfolio/awaiting-metric-state";
import { Card } from "@/components/ui/card";
import { Metric } from "@/components/ui/metric";
import { NestedKpiGrid } from "@/components/ui/nested-panel";
import { DashboardPanelHeader } from "@/components/ui/system-panel";
import type { CoverageView } from "@/lib/engine/coverage-view";

/**
 * Mining Cash-Flow Evidence — the RWA proof that matters most: the yield source.
 * Reserves prove the principal is custodied; THIS proves the distribution is
 * funded by real mining revenue, via the distribution-coverage engine.
 *
 * When `coverage` is provided it renders the live/estimated/pending state from
 * the engine. With no inputs attested yet (pre-launch), it stays Pending — never
 * a fabricated figure, never "Live" without complete inputs, never "healthy"
 * when coverage < 1.0.
 */

// Required copy per state (P1).
const COPY: Record<CoverageView["provenance"], string> = {
  live: "Coverage calculated from complete mining cash-flow inputs.",
  estimated:
    "Estimated from available (demo/staging) mining inputs. Not attested.",
  pending: "Coverage pending until mining cash-flow inputs are attested.",
  invalid: "Coverage unavailable — mining cash-flow inputs are invalid.",
};

// Map coverage provenance → ProvenanceBadge kind (never "live" unless attested).
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
    return (
      <AwaitingMetricState
        message={
          provenance === "invalid"
            ? "Mining cash-flow coverage unavailable"
            : "Mining cash-flow coverage pending"
        }
        detail={COPY[provenance]}
      />
    );
  }

  const ratioLabel =
    coverage && coverage.ratio !== null ? `${coverage.ratio.toFixed(2)}×` : "Pending";
  const coverageState = coverage?.state ?? "invalid";

  return (
    <Card>
      <DashboardPanelHeader
        eyebrow="Mining cash-flow evidence"
        title="Yield source — Bitcoin mining revenue"
        provenance={BADGE[provenance]}
        tone="primary"
      />

      <p className="body-sm mb-4">{COPY[provenance]}</p>

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
          value={coverageState}
          sublabel={coverage?.recommendation.action ?? "—"}
        />
        <Metric
          variant="nested"
          label="Latest revenue period"
          value={coverage?.period ?? "—"}
          sublabel={
            coverage?.lastUpdated ? "as of attestation" : "awaiting first close"
          }
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
