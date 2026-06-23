import { InvestFlowLoadingShell } from "@/components/vaults/invest-flow-loading-shell";

export default function VaultDetailLoading() {
  return (
    <InvestFlowLoadingShell
      showLead
      showActions
      showOverview
      bodySections={3}
    />
  );
}
