// PanelStatus preview — inline state line for panels (muted note / danger error),
// plus the section and accent wrappers. Realistic Hearst Yield Vault operations copy.
import {
  PanelStatus,
  PanelStatusSection,
  PanelStatusAccent,
} from "hearst-connect";

const wrap: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "16px",
  minWidth: "380px",
  maxWidth: "460px",
};

export const Muted = () => (
  <div style={wrap}>
    <PanelStatus
      tone="muted"
      message="No redemption requests in the current 60-day window."
      detail="Approved exits will appear here once the soft lock-up clears."
    />
  </div>
);

export const Danger = () => (
  <div style={wrap}>
    <PanelStatus
      tone="danger"
      message="Couldn't load the hashprice oracle feed."
      detail="The attested source is unavailable — retry shortly."
      role="alert"
    />
  </div>
);

export const SectionAndAccent = () => (
  <div style={wrap}>
    <PanelStatusSection label="Custody attestation">
      <PanelStatus
        tone="muted"
        message="Reserves attested by the Cayman administrator on 30 Jun."
        detail="Next attestation scheduled for the monthly distribution cycle."
      />
    </PanelStatusSection>
    <PanelStatusAccent>
      Projected net APY holds at 9.4–12.8% under base assumptions — a range,
      not a single point, and not guaranteed.
    </PanelStatusAccent>
  </div>
);
