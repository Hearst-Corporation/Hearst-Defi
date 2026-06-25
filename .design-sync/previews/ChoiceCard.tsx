// ChoiceCard preview — single-select option cards for qualification / onboarding,
// wrapped in a ChoiceGroup fieldset (legend uses canonical form-label styling).
// One option selected per group; onClick is a no-op in previews.
import { ChoiceCard, ChoiceGroup } from "hearst-connect";

const noop = () => {};

export const RiskTolerance = () => (
  <div style={{ maxWidth: "440px" }}>
    <ChoiceGroup legend="Risk tolerance">
      <ChoiceCard label="Conservative" selected={false} onClick={noop} />
      <ChoiceCard label="Balanced" selected onClick={noop} />
      <ChoiceCard label="Growth" selected={false} onClick={noop} />
    </ChoiceGroup>
  </div>
);

export const TicketSize = () => (
  <div style={{ maxWidth: "440px" }}>
    <ChoiceGroup legend="Intended allocation">
      <ChoiceCard label="$250k – $500k" selected onClick={noop} />
      <ChoiceCard label="$500k – $1M" selected={false} onClick={noop} />
      <ChoiceCard label="$1M+" selected={false} onClick={noop} />
    </ChoiceGroup>
  </div>
);

export const Horizon = () => (
  <div style={{ maxWidth: "440px" }}>
    <ChoiceGroup legend="Investment horizon">
      <ChoiceCard label="Under 12 months" selected={false} onClick={noop} />
      <ChoiceCard label="1 – 3 years" selected={false} onClick={noop} />
      <ChoiceCard label="3 years or more" selected onClick={noop} />
    </ChoiceGroup>
  </div>
);
