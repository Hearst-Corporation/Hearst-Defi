// SegmentedControl preview — the canonical "pick one of N" primitive. Selection
// stays QUIET (surface lift, never accent fill). tablist switches a view;
// radiogroup picks a value. onChange is a no-op in previews.
import { SegmentedControl } from "hearst-connect";

const stack: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "18px",
  maxWidth: "520px",
};

const noop = () => {};

export const Tablist = () => (
  <div style={{ maxWidth: "520px" }}>
    <SegmentedControl
      ariaLabel="Vault view"
      variant="tablist"
      value="overview"
      onChange={noop}
      items={[
        { value: "overview", label: "Overview" },
        { value: "performance", label: "Performance" },
        { value: "holdings", label: "Holdings" },
      ]}
    />
  </div>
);

export const Radiogroup = () => (
  <div style={{ maxWidth: "520px" }}>
    <SegmentedControl
      ariaLabel="Share class"
      variant="radiogroup"
      value="institutional"
      onChange={noop}
      items={[
        { value: "founder", label: "Founder" },
        { value: "institutional", label: "Institutional" },
        { value: "standard", label: "Standard" },
      ]}
    />
  </div>
);

export const Both = () => (
  <div style={stack}>
    <SegmentedControl
      ariaLabel="Proof center section"
      variant="tablist"
      value="attestations"
      onChange={noop}
      items={[
        { value: "attestations", label: "Attestations" },
        { value: "reserves", label: "Reserves" },
        { value: "audits", label: "Audits" },
        { value: "distributions", label: "Distributions" },
      ]}
    />
    <SegmentedControl
      ariaLabel="Distribution cadence"
      variant="radiogroup"
      value="monthly"
      onChange={noop}
      items={[
        { value: "monthly", label: "Monthly" },
        { value: "quarterly", label: "Quarterly" },
      ]}
    />
  </div>
);
