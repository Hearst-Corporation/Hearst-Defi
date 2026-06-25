// NestedPanel preview — the evidence box that lives inside an active Card.
// Holds a stack of DataRows; default (hairline) vs borderless variant. Wrapped in
// a flat Card so the nesting reads correctly (never glass-on-glass).
import { Card, NestedPanel, DataRow } from "hearst-connect";

export const Default = () => (
  <div style={{ width: "360px" }}>
    <Card material="flat">
      <NestedPanel>
        <DataRow label="Custodian">Fireblocks</DataRow>
        <DataRow label="Vault contract">0x6f1a…c2</DataRow>
        <DataRow label="Reserve ratio">103.4%</DataRow>
        <DataRow label="Min ticket">$250,000</DataRow>
      </NestedPanel>
    </Card>
  </div>
);

export const Borderless = () => (
  <div style={{ width: "360px" }}>
    <Card material="flat">
      <NestedPanel variant="borderless">
        <DataRow label="Structure">Cayman SPV</DataRow>
        <DataRow label="Soft lock-up">60 days</DataRow>
        <DataRow label="Distribution">Monthly · USDC</DataRow>
      </NestedPanel>
    </Card>
  </div>
);
