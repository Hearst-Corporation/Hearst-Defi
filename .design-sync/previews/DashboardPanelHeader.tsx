// DashboardPanelHeader preview — the standard panel header: eyebrow, title, optional
// subtitle, a status pill, and a provenance strip badge. Primary (accent title) vs
// quiet tone, plus a section-level header.
import { DashboardPanelHeader } from "hearst-connect";

const frame: React.CSSProperties = {
  width: "480px",
  padding: "18px 20px",
  borderRadius: "14px",
  border: "1px solid var(--ct-border-ghost)",
  background: "var(--ct-surface-1)",
};

export const Primary = () => (
  <div style={frame}>
    <DashboardPanelHeader
      eyebrow="PORTFOLIO"
      title="Hearst Yield Vault"
      subtitle="Cayman SPV · mining-backed · monthly USDC"
      provenance="attested"
      status="Live"
      statusTone="ok"
      tone="primary"
    />
  </div>
);

export const Quiet = () => (
  <div style={frame}>
    <DashboardPanelHeader
      eyebrow="PROOF CENTER"
      title="Reserve attestation"
      subtitle="administrator-signed · 30 Jun"
      provenance="oracle"
      status="Watch"
      statusTone="watch"
      tone="quiet"
    />
  </div>
);

export const SectionLevel = () => (
  <div style={frame}>
    <DashboardPanelHeader
      titleLevel="section"
      eyebrow="OPERATIONS"
      title="Distribution schedule"
      subtitle="next cycle · 01 Jul"
      provenance="estimated"
      status="Idle"
      statusTone="idle"
      tone="quiet"
    />
  </div>
);

export const Alert = () => (
  <div style={frame}>
    <DashboardPanelHeader
      eyebrow="MINING HEALTH"
      title="Hashprice coverage"
      subtitle="margin 1.32× · 7-day"
      provenance="stale"
      status="Alert"
      statusTone="alert"
      tone="primary"
    />
  </div>
);
