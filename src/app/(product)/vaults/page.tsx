import { EmptySurface } from "@/components/ui/empty-surface";
import { listVaults } from "@/lib/data/vaults";
import { InvestFlowShell } from "@/components/vaults/invest-flow-shell";
import { ProductSelectCard } from "@/components/vaults/product-select-card";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Select a Product — Hearst Yield Vault",
};

export default async function VaultsPage() {
  const vaults = await listVaults();

  return (
    <InvestFlowShell
      step="select"
      width="full"
      titleLead="Select a"
      titleAccent="Product"
      contextLabel="Investment Flow"
    >
      <section aria-label="Available products">
        {vaults.length === 0 ? (
          <EmptySurface
            live
            variant="inline"
            message="No vault is currently deployed with a verified on-chain contract."
            detail="Products appear here once a vault is live on Base Sepolia with a confirmed deployment address."
          />
        ) : (
          <div className="product-doc-stack">
            {vaults.map((vault) => (
              <ProductSelectCard key={vault.id} vault={vault} />
            ))}
          </div>
        )}
      </section>
    </InvestFlowShell>
  );
}
