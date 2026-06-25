// Badge preview — status pills coloured by semantic tone (never a second green).
// Sweeps every variant with realistic Hearst Yield Vault labels, plus a row of
// pills as they appear inline on a vault row.
import { Badge } from "hearst-connect";

const row: React.CSSProperties = {
  display: "flex",
  gap: "10px",
  alignItems: "center",
  flexWrap: "wrap",
};

export const Variants = () => (
  <div style={row}>
    <Badge>DEFAULT</Badge>
    <Badge variant="success">ATTESTED</Badge>
    <Badge variant="warning">PENDING REVIEW</Badge>
    <Badge variant="danger">STALE</Badge>
    <Badge variant="accent">LIVE</Badge>
    <Badge variant="brand">AUDITED</Badge>
  </div>
);

export const StatusLabels = () => (
  <div style={row}>
    <Badge variant="accent">OPEN</Badge>
    <Badge variant="success">SOFT LOCK-UP</Badge>
    <Badge variant="warning">KYC PENDING</Badge>
    <Badge variant="danger">REDEMPTION QUEUED</Badge>
  </div>
);

export const Flat = () => (
  <div style={row}>
    <Badge variant="flat">Cayman SPV</Badge>
    <Badge variant="flat">$250k min ticket</Badge>
    <Badge variant="flat">Monthly USDC</Badge>
  </div>
);

export const VaultRow = () => (
  <div style={{ ...row, gap: "8px" }}>
    <Badge variant="brand">HEARST YIELD VAULT</Badge>
    <Badge variant="accent">LIVE</Badge>
    <Badge variant="success">AUDITED</Badge>
    <Badge variant="flat">60-day lock-up</Badge>
  </div>
);
