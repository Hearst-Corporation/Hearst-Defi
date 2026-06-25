// Tooltip preview — wraps a trigger; the floating content appears on hover/focus.
// Static cards show the styled triggers (the hover state can't render statically).
import { Tooltip, Button } from "hearst-connect";

export const OnLabel = () => (
  <Tooltip content="Net APY is shown as a range, attested monthly.">
    <span
      className="stat-label ct-text-muted"
      style={{ borderBottom: "1px dotted", cursor: "help" }}
    >
      Net APY (range)
    </span>
  </Tooltip>
);

export const OnButton = () => (
  <Tooltip content="Opens the latest on-chain reserve attestation." side="bottom">
    <Button variant="secondary">View proof</Button>
  </Tooltip>
);
