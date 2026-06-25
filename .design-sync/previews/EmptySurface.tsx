// EmptySurface preview — honest empty states. Widget, chart, and inline variants.
// No fake "Live"/"Verified" badges, no mock data. Widget/chart are width-bounded.
import { EmptySurface } from "hearst-connect";

export const Widget = () => (
  <div style={{ width: "320px" }}>
    <EmptySurface
      message="No active positions yet"
      detail="Your portfolio will appear here once your subscription settles."
    />
  </div>
);

export const Chart = () => (
  <div style={{ width: "320px" }}>
    <EmptySurface
      variant="chart"
      message="No distribution history yet"
      detail="The first monthly USDC distribution charts here after settlement."
    />
  </div>
);

export const Inline = () => (
  <div style={{ width: "320px" }}>
    <EmptySurface
      variant="inline"
      message="No attestations on file for this period."
    />
  </div>
);
