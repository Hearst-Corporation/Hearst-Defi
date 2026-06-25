import { ProofCenterHub } from "@/components/proof-center/proof-center-hub";
import type { ProofCenterHubData } from "@/lib/proof-center/hub-data";

interface ProofCenterHubLayoutProps extends ProofCenterHubData {
  variant: "product" | "admin";
  vaultId?: string;
}

export function ProofCenterHubLayout({
  variant,
  vaultId,
  ...hubData
}: ProofCenterHubLayoutProps) {
  return (
    <ProofCenterHub
      variant={variant}
      vaultRef={vaultId}
      demo={false}
      {...hubData}
    />
  );
}
