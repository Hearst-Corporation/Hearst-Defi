// ConfirmDialog preview — destructive confirmation, shown OPEN (renders null when
// closed). Card mode "single". One plain confirm, one type-to-confirm guarded.
import { ConfirmDialog } from "hearst-connect";

const noop = () => {};
const noopAsync = async () => {};

export const Destructive = () => (
  <ConfirmDialog
    open
    onOpenChange={noop}
    title="Withdraw position?"
    description="This queues a full redemption of your Hearst Yield Vault position. Settlement follows the 60-day soft lock-up."
    confirmLabel="Queue withdrawal"
    confirmVariant="danger"
    onConfirm={noopAsync}
  />
);

export const TypeToConfirm = () => (
  <ConfirmDialog
    open
    onOpenChange={noop}
    title="Pause distributions?"
    description="Pausing halts the monthly USDC distribution run for all share classes until resumed."
    confirmLabel="Pause distributions"
    confirmVariant="danger"
    confirmPhrase="PAUSE"
    onConfirm={noopAsync}
  />
);
