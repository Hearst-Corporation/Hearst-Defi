// MetricGrid preview — a grid of nested Metrics, each carrying provenance
// (non-negotiable #2). Realistic vault KPIs. Demos 3-column and 2-column layouts.
import { MetricGrid, Metric } from "hearst-connect";

export const ThreeColumn = () => (
  <div style={{ width: "520px" }}>
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
        label="Assets under management"
        value="$48.2M"
        provenance="attested"
      />
    </MetricGrid>
  </div>
);

export const TwoColumn = () => (
  <div style={{ width: "380px" }}>
    <MetricGrid columns={2}>
      <Metric
        variant="nested"
        label="Reserve ratio"
        value="103.4%"
        provenance="live"
      />
      <Metric
        variant="nested"
        label="Next distribution"
        value="$412,900"
        provenance="estimated"
      />
    </MetricGrid>
  </div>
);
