// ApyRange preview — APY is ALWAYS a range, never a single point (non-negotiable #1).
// Canonical en-dash range with provenance-aware sublabels. Shown at body and headline
// scale, with a span of realistic Hearst Yield Vault assumptions.
import { ApyRange } from "hearst-connect";

const stack: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "14px",
};

const labelStyle: React.CSSProperties = {
  fontSize: "11px",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--ct-text-muted)",
};

const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: "24px",
};

export const TargetBand = () => (
  <div style={{ ...stack, minWidth: "260px" }}>
    <span style={labelStyle}>Hearst Yield Vault · target APY</span>
    <div style={{ fontSize: "20px" }}>
      <ApyRange low={8.0} high={15.0} />
    </div>
  </div>
);

export const NetEstimate = () => (
  <div style={{ ...stack, minWidth: "300px" }}>
    <div style={rowStyle}>
      <span style={labelStyle}>Gross APY</span>
      <ApyRange low={9.4} high={12.8} />
    </div>
    <div style={rowStyle}>
      <span style={labelStyle}>Net of fees</span>
      <ApyRange low={8.1} high={11.2} />
    </div>
    <div style={rowStyle}>
      <span style={labelStyle}>Defensive sleeve</span>
      <ApyRange low={5.6} high={7.0} />
    </div>
  </div>
);

export const Headline = () => (
  <div style={{ ...stack, minWidth: "320px" }}>
    <span style={labelStyle}>Projected net APY · estimated</span>
    <div style={{ fontSize: "28px" }}>
      <ApyRange low={9.4} high={12.8} />
    </div>
    <span style={{ fontSize: "12px", color: "var(--ct-text-faint)" }}>
      Range, not a single point — assumptions apply, not guaranteed.
    </span>
  </div>
);

export const Precision = () => (
  <div style={{ ...stack, minWidth: "260px" }}>
    <div style={rowStyle}>
      <span style={labelStyle}>Whole-number</span>
      <ApyRange low={8} high={15} precision={0} />
    </div>
    <div style={rowStyle}>
      <span style={labelStyle}>One decimal</span>
      <ApyRange low={9.4} high={12.8} precision={1} />
    </div>
    <div style={rowStyle}>
      <span style={labelStyle}>Two decimal</span>
      <ApyRange low={9.42} high={12.83} precision={2} />
    </div>
  </div>
);
