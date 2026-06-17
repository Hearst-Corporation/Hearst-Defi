import { MINING_CASHFLOW_COPY } from "@/components/proof/empty-messages";
import { Card } from "@/components/ui/card";
import { Metric } from "@/components/ui/metric";
import { MetricGrid } from "@/components/ui/nested-panel";
import type { CoverageView } from "@/lib/engine/coverage-view";

import { ProofCenterCardHeader } from "./proof-center-card-header";

const BADGE: Record<CoverageView["provenance"], "live" | "estimated" | "manual" | "stale"> = {
  live: "live",
  estimated: "estimated",
  pending: "manual",
  invalid: "stale",
};

const HEADER = {
  eyebrow: "Mining cash-flow evidence",
  title: "Yield source — Bitcoin mining revenue",
} as const;

export function MiningCashFlowEvidence({
  coverage,
  sectionLed = false,
}: {
  coverage?: CoverageView | null;
  sectionLed?: boolean;
}) {
  const provenance = coverage?.provenance ?? "pending";

  // Pending / invalid — render the FULL instrument shell (header + provenance +
  // a calibration rail + a ghost KPI grid) rather than a bare empty surface, so
  // the panel reads as an instrument awaiting attestation, never broken-empty.
  // No fake Live/Verified: badge is Manual (pending) / Stale (invalid), values "—".
  if (provenance === "pending" || provenance === "invalid") {
    const stateLabel = provenance === "invalid" ? "Invalid" : "Pending";
    return (
      <Card aria-label="Mining cash-flow evidence — awaiting attestation">
        <ProofCenterCardHeader
          sectionLed={sectionLed}
          eyebrow={HEADER.eyebrow}
          title={HEADER.title}
          provenance={BADGE[provenance]}
          tone="primary"
        />

        <p className="body-sm mb-4">{MINING_CASHFLOW_COPY[provenance]}</p>

        <div className="mining-coverage-calibration mb-4" role="status">
          <span className="mining-coverage-calibration__bar" aria-hidden />
          <span className="sr-only">
            {provenance === "invalid"
              ? "Mining cash-flow coverage unavailable"
              : "Mining cash-flow coverage pending — calibrating"}
          </span>
        </div>

        <MetricGrid columns={4}>
          <Metric
            variant="nested"
            label="Distribution coverage"
            value="—"
            sublabel="net mining cash ÷ target"
          />
          <Metric
            variant="nested"
            label="State"
            value={stateLabel}
            sublabel="awaiting inputs"
          />
          <Metric
            variant="nested"
            label="Latest revenue period"
            value="—"
            sublabel="awaiting first close"
          />
          <Metric
            variant="nested"
            label="Attestation status"
            value="Pending"
            sublabel="mining partner + pool"
          />
        </MetricGrid>
      </Card>
    );
  }

  const ratioLabel =
    coverage?.ratio !== null && coverage?.ratio !== undefined
      ? `${coverage.ratio.toFixed(2)}×`
      : "Pending";

  return (
    <Card>
      <ProofCenterCardHeader
        sectionLed={sectionLed}
        eyebrow={HEADER.eyebrow}
        title={HEADER.title}
        provenance={BADGE[provenance]}
        tone="primary"
      />

      <p className="body-sm mb-4">{MINING_CASHFLOW_COPY[provenance]}</p>

      <MetricGrid columns={4}>
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
      </MetricGrid>
    </Card>
  );
}
