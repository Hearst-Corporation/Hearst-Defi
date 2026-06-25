// ChartTimeSelector preview — segmented time-range control for charts. 24px,
// mono font, accessible radiogroup; active segment underlined in the green accent.
// onChange is a no-op in previews.
import { ChartTimeSelector } from "hearst-connect";

const noop = () => {};

export const Default = () => (
  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
    <ChartTimeSelector value="3M" onChange={noop} />
  </div>
);

export const CustomRange = () => (
  <ChartTimeSelector
    value="1Y"
    onChange={noop}
    options={["3M", "6M", "1Y", "ALL"]}
  />
);
