// ProofRow preview — proof-center evidence line. Same visual as DataRow, semantic
// intent is attestation/audit evidence. Rendered inside a NestedPanel in a flat Card.
import { Card, NestedPanel, ProofRow } from "hearst-connect";

export const Attestation = () => (
  <div style={{ width: "360px" }}>
    <Card material="flat">
      <NestedPanel>
        <ProofRow label="Attestation date">2026-06-01 UTC</ProofRow>
        <ProofRow label="Auditor">The Network Firm</ProofRow>
        <ProofRow label="Reserve ratio">103.4%</ProofRow>
        <ProofRow label="Evidence hash">0x7c…12f</ProofRow>
      </NestedPanel>
    </Card>
  </div>
);

export const OnChainProof = () => (
  <div style={{ width: "360px" }}>
    <Card material="flat">
      <NestedPanel>
        <ProofRow label="Attestor">Hearst SPV</ProofRow>
        <ProofRow label="Block">0x1f…a90</ProofRow>
        <ProofRow label="Vault contract">0x6f1a…c2</ProofRow>
        <ProofRow label="Network">Base Sepolia</ProofRow>
      </NestedPanel>
    </Card>
  </div>
);
