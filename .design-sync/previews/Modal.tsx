// Modal preview — the canonical overlay primitive, shown OPEN (it renders null
// when isOpen is false). Card mode is "single" so the open panel fills the card.
import { Modal, Button, DataRow, NestedPanel } from "hearst-connect";

const noop = () => {};

export const Open = () => (
  <Modal
    isOpen
    onClose={noop}
    title="Subscription summary"
    headerActions={<Button variant="ghost" size="sm">Export PDF</Button>}
  >
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <p className="body-sm ct-text-muted" style={{ margin: 0 }}>
        Review the terms before confirming your allocation to the Hearst Yield Vault.
      </p>
      <NestedPanel>
        <DataRow label="Ticket size">$250,000 USDC</DataRow>
        <DataRow label="Target net APY">9.4–12.8%</DataRow>
        <DataRow label="Soft lock-up">60 days</DataRow>
        <DataRow label="Distributions">Monthly · USDC</DataRow>
      </NestedPanel>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
        <Button variant="ghost">Cancel</Button>
        <Button variant="primary">Confirm allocation</Button>
      </div>
    </div>
  </Modal>
);
