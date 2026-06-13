import { AwaitingMetricState } from "@/components/portfolio/awaiting-metric-state";
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
      title="Select a product"
      description="Professional-grade structured yield for qualified investors. Review the term sheet and confirm before depositing."
      footer={
        <p className="body-xs ct-text-faint ct-prose-xl">
          Products listed are offered exclusively to professional and qualified
          investors. Past performance does not indicate future results. APY
          ranges are not a projection of returns. Subject to minimum
          subscription, jurisdictional restrictions, and soft lock-up terms.
        </p>
      }
    >
      <section aria-labelledby="vaults-heading">
        <h2 id="vaults-heading" className="h2 mb-4">
          Available products
        </h2>

        {vaults.length === 0 ? (
          <AwaitingMetricState
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
