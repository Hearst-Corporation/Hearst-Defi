import { loadVaultPageData } from "./_data/vault-loader";
import { VaultsView } from "@/views/investor/vaults-view";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Series 1 Vault · Hearst Bitcoin Reserve Vault",
  description:
    "BTC-accumulation instrument backed by real Bitcoin mining, delivered at maturity.",
};

export default async function VaultsPage() {
  const data = await loadVaultPageData();
  return <VaultsView data={data} />;
}
