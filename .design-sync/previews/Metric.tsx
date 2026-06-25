// Metric preview — the headline KPI primitive. Composes ApyRange + ProvenanceBadge
// + trend. APY is always shown as a range (non-negotiable #1). Premium, nested, and
// a MetricGrid row of three.
import { Metric, MetricGrid, ApyRange } from "hearst-connect";

export const Premium = () => (
  <div style={{ maxWidth: "320px" }}>
    <Metric
      label="Net APY (range)"
      value={<ApyRange low={9.4} high={12.8} />}
      provenance="estimated"
      trend={{ direction: "up", text: "+0.6 vs last month" }}
      sublabel="Hearst Yield Vault"
    />
  </div>
);

export const WithTooltip = () => (
  <div style={{ maxWidth: "320px" }}>
    <Metric
      label="Assets under management"
      value="$48.2M"
      provenance="attested"
      tooltip="Total USDC deposited across all share classes, attested monthly."
      sublabel="as of 30 Jun"
    />
  </div>
);

export const Nested = () => (
  <Metric
    variant="nested"
    label="Next distribution"
    value="$412,900"
    sublabel="USDC · 01 Jul"
  />
);

export const Grid = () => (
  <MetricGrid columns={3}>
    <Metric
      variant="nested"
      label="NAV / share"
      value="$1.041"
      provenance="oracle"
    />
    <Metric
      variant="nested"
      label="Monthly distribution"
      value="0.84%"
      provenance="attested"
    />
    <Metric
      variant="nested"
      label="Soft lock-up"
      value="60 days"
      provenance="manual"
    />
  </MetricGrid>
);
