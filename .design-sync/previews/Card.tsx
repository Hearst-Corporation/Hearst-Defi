// Card preview — the graphite module surface. Glass (default) vs flat, default vs
// compact density, with CardHeader + CardTitle and realistic vault body content.
// Each card is given a fixed width via a wrapping div.
import {
  Card,
  CardHeader,
  CardTitle,
  Badge,
} from "hearst-connect";

export const GlassWithHeader = () => (
  <div style={{ width: "360px" }}>
    <Card>
      <CardHeader>
        <CardTitle>Hearst Yield Vault</CardTitle>
        <Badge variant="accent">Open</Badge>
      </CardHeader>
      <p className="body-sm ct-text-muted m-0">
        Mining-backed structured yield with monthly USDC distributions. Target
        net APY 9.4–12.8%, $250k minimum ticket, 60-day soft lock-up.
      </p>
    </Card>
  </div>
);

export const Flat = () => (
  <div style={{ width: "360px" }}>
    <Card material="flat">
      <CardHeader>
        <CardTitle>Reserve coverage</CardTitle>
      </CardHeader>
      <p className="body-sm ct-text-muted m-0">
        Opaque module surface for dense lists and proof tables — no frost, so
        nested boxes never read as glass-on-glass.
      </p>
    </Card>
  </div>
);

export const Compact = () => (
  <div style={{ width: "360px" }}>
    <Card density="compact" material="flat">
      <CardHeader>
        <CardTitle>Next distribution</CardTitle>
      </CardHeader>
      <p className="body-sm ct-text-muted m-0">
        Compact density tightens the padding for sidebar widgets and stacked
        cards. $412,900 USDC settles on 01 Jul.
      </p>
    </Card>
  </div>
);
