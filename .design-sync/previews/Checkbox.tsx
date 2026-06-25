// Checkbox preview — DS checkbox with sr-only native input + custom accent box.
// Subscription / onboarding consents for the Hearst Yield Vault. onChange is a
// no-op in previews; checked + unchecked states are both shown.
import { Checkbox } from "hearst-connect";

const stack: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "14px",
  maxWidth: "420px",
};

const noop = () => {};

export const Checked = () => (
  <div style={stack}>
    <Checkbox checked onChange={noop}>
      I accept the subscription agreement and PPM disclosures.
    </Checkbox>
    <Checkbox checked onChange={noop}>
      I confirm I am an accredited / qualified investor.
    </Checkbox>
  </div>
);

export const Unchecked = () => (
  <div style={stack}>
    <Checkbox checked={false} onChange={noop}>
      Subscribe me to monthly distribution notices.
    </Checkbox>
    <Checkbox checked={false} onChange={noop}>
      I acknowledge the 60-day soft lock-up on redemptions.
    </Checkbox>
  </div>
);

export const Mixed = () => (
  <div style={stack}>
    <Checkbox checked onChange={noop}>
      I understand projected APY is shown as a range (9.4–12.8%), not a single number.
    </Checkbox>
    <Checkbox checked={false} onChange={noop}>
      I have read the Cayman SPV structure and fee schedule.
    </Checkbox>
  </div>
);
