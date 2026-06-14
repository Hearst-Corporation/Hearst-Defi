import { InvestFlowLoadingShell } from "@/components/vaults/invest-flow-loading-shell";

export default function VaultDetailLoading() {
  return (
    <InvestFlowLoadingShell
      workspace
      showLead
      showActions
      showKpiRow
      bodyCards={3}
    />
  );
}
