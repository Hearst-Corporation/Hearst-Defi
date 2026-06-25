// Progress preview — slim risk/score/fill bars. Default carries the shimmer +
// inset; `plain` drops them for dense admin lists. fillClassName overrides the
// fill colour (e.g. danger). Each bar is wrapped to a fixed width.
import { Progress } from "hearst-connect";

const col: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "18px",
};

const cell: React.CSSProperties = { width: "260px" };

const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: "8px",
  fontSize: "11px",
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--ct-text-muted)",
};

export const Default = () => (
  <div style={col}>
    <div style={cell}>
      <span style={labelStyle}>Subscription progress · 35%</span>
      <Progress value={35} label="Subscription progress" />
    </div>
    <div style={cell}>
      <span style={labelStyle}>Allocation filled · 72%</span>
      <Progress value={72} label="Allocation filled" />
    </div>
    <div style={cell}>
      <span style={labelStyle}>Capacity · 100%</span>
      <Progress value={100} label="Vault capacity" />
    </div>
  </div>
);

export const Plain = () => (
  <div style={col}>
    <div style={cell}>
      <span style={labelStyle}>Reserve coverage · 88%</span>
      <Progress value={88} variant="plain" label="Reserve coverage" />
    </div>
    <div style={cell}>
      <span style={labelStyle}>Attestation freshness · 54%</span>
      <Progress value={54} variant="plain" label="Attestation freshness" />
    </div>
  </div>
);

export const Risk = () => (
  <div style={col}>
    <div style={cell}>
      <span style={labelStyle}>Liquidity risk · 38 / 100</span>
      <Progress
        value={38}
        variant="plain"
        fillClassName="bg-[var(--ct-status-success)]"
        label="Liquidity risk score 38 of 100"
      />
    </div>
    <div style={cell}>
      <span style={labelStyle}>Concentration risk · 81 / 100</span>
      <Progress
        value={81}
        variant="plain"
        fillClassName="bg-[var(--ct-status-danger)]"
        label="Concentration risk score 81 of 100"
      />
    </div>
  </div>
);
