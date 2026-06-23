import { MINING_CASHFLOW_COPY } from "@/components/proof/empty-messages";
import { Card } from "@/components/ui/card";
import { Metric } from "@/components/ui/metric";
import { MetricGrid } from "@/components/ui/nested-panel";
import type { CoverageView } from "@/lib/engine/coverage-view";

import { ProofCenterCardHeader } from "./proof-center-card-header";
import type { ProofCenterSectionLedProps } from "./proof-center-types";

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
} & ProofCenterSectionLedProps) {
  const provenance = coverage?.provenance ?? "pending";

  // Pending / invalid — render the FULL instrument shell (header + provenance +
  // a calibration rail + a ghost KPI grid) rather than a bare empty surface, so
  // the panel reads as an instrument awaiting attestation, never broken-empty.
  // No fake Live/Verified: badge is Manual (pending) / Stale (invalid), values "—".
  if (provenance === "pending" || provenance === "invalid") {
    return (
      <Card material="flat" aria-label="Mining cash-flow evidence — awaiting attestation">
        <ProofCenterCardHeader
          sectionLed={sectionLed}
          eyebrow={sectionLed ? HEADER.eyebrow : "Awaiting attestation"}
          title={sectionLed ? HEADER.title : "Mining Revenue"}
          provenance={BADGE[provenance]}
          tone="quiet"
        />
        <p className="body-sm ct-text-muted m-0" role="status">
          {MINING_CASHFLOW_COPY[provenance]}
        </p>
      </Card>
    );
  }

  const ratioLabel =
    coverage?.ratio !== null && coverage?.ratio !== undefined
      ? `${coverage.ratio.toFixed(2)}×`
      : "Pending";

  return (
    <Card material="flat">
      <ProofCenterCardHeader
        sectionLed={sectionLed}
        eyebrow={sectionLed ? HEADER.eyebrow : "Yield Evidence"}
        title={sectionLed ? HEADER.title : "Mining Revenue"}
        provenance={BADGE[provenance]}
        tone={sectionLed ? "primary" : "quiet"}
      />

      <p className="body-sm proof-article-lede">{MINING_CASHFLOW_COPY[provenance]}</p>

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
