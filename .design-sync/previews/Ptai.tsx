// Ptai preview — the mandatory Projection → Trigger → Action → Impact format for
// every simulation / rebalancing action (non-negotiable #3). Inset (default, nested
// surface) and flat (parent card owns the surface). Realistic mining-margin scenarios.
import { Ptai } from "hearst-connect";

const wrap: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "16px",
  minWidth: "440px",
  maxWidth: "560px",
};

const eyebrow: React.CSSProperties = {
  fontSize: "11px",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--ct-text-muted)",
};

export const RebalanceInset = () => (
  <div style={wrap}>
    <span style={eyebrow}>Proposed rebalance · draft</span>
    <Ptai
      projection="Net APY drifts to 9.4–10.1% if hashprice softens 8%"
      trigger="Mining margin falls below 1.4× for 7 consecutive days"
      action="Rotate 12% of the cash buffer into the defensive sleeve"
      impact="Stabilises the monthly USDC distribution at ~0.8%"
    />
  </div>
);

export const DistributionGuard = () => (
  <div style={wrap}>
    <span style={eyebrow}>Distribution guard · estimated</span>
    <Ptai
      projection="Coverage ratio thins to 1.05× into the August distribution"
      trigger="Realised hashprice prints below $42/PH for two weeks"
      action="Hold 4% of NAV in T-bills and defer the discretionary top-up"
      impact="Keeps net APY inside the 8.6–11.4% band, not guaranteed"
    />
  </div>
);

export const FlatInCard = () => (
  <div
    style={{
      ...wrap,
      padding: "20px",
      borderRadius: "14px",
      border: "1px solid var(--ct-border-ghost)",
      background: "var(--ct-surface-1)",
    }}
  >
    <span style={eyebrow}>Owned surface · variant="flat"</span>
    <Ptai
      variant="flat"
      projection="Soft lock-up queue clears 60-day backlog by month-end"
      trigger="Redemption requests exceed 6% of the share class in a window"
      action="Stage gated exits in tranches and surface a provenance badge"
      impact="Preserves orderly NAV per share across remaining holders"
    />
  </div>
);
