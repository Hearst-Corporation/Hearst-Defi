// Button preview — the four variants, three sizes, and disabled state.
// Accent fill (primary) is reserved for the single main action per surface.
import { Button } from "hearst-connect";

const row: React.CSSProperties = {
  display: "flex",
  gap: "12px",
  alignItems: "center",
  flexWrap: "wrap",
};

export const Variants = () => (
  <div style={row}>
    <Button variant="primary">Invest now</Button>
    <Button variant="secondary">View proof</Button>
    <Button variant="ghost">Cancel</Button>
    <Button variant="danger">Withdraw</Button>
  </div>
);

export const Sizes = () => (
  <div style={row}>
    <Button variant="primary" size="sm">
      Small
    </Button>
    <Button variant="primary" size="md">
      Medium
    </Button>
    <Button variant="primary" size="lg">
      Large
    </Button>
  </div>
);

export const Disabled = () => (
  <div style={row}>
    <Button variant="primary" disabled>
      Invest now
    </Button>
    <Button variant="secondary" disabled>
      View proof
    </Button>
  </div>
);
