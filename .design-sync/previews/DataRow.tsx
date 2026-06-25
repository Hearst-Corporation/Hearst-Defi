// DataRow preview — a label/value line, mono tabular value. Always rendered inside
// a NestedPanel, inside a flat Card. Realistic vault metadata blocks.
import { Card, NestedPanel, DataRow } from "hearst-connect";

export const VaultTerms = () => (
  <div style={{ width: "360px" }}>
    <Card material="flat">
      <NestedPanel>
        <DataRow label="Strategy">Mining-backed yield</DataRow>
        <DataRow label="Target net APY">9.4–12.8%</DataRow>
        <DataRow label="Minimum ticket">$250,000</DataRow>
        <DataRow label="Soft lock-up">60 days</DataRow>
        <DataRow label="Distribution">Monthly · USDC</DataRow>
      </NestedPanel>
    </Card>
  </div>
);

export const Custody = () => (
  <div style={{ width: "360px" }}>
    <Card material="flat">
      <NestedPanel>
        <DataRow label="Custodian">Fireblocks</DataRow>
        <DataRow label="SPV jurisdiction">Cayman Islands</DataRow>
        <DataRow label="AUM">$48.2M</DataRow>
        <DataRow label="NAV / share">$1.041</DataRow>
      </NestedPanel>
    </Card>
  </div>
);
