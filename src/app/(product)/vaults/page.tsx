import { AwaitingMetricState } from "@/components/ui/awaiting-metric-state";
import { listVaults } from "@/lib/data/vaults";
import { getInvestor } from "@/lib/auth/session";
import { isDemoInvestor } from "@/lib/demo/provider";
import { buildDemoVaults } from "@/lib/demo/builders";
import { DEMO_SANDBOX_DISCLAIMER } from "@/lib/demo/markers";
import { DemoDataBanner } from "@/components/product/demo-data-banner";
import { InvestFlowShell } from "@/components/vaults/invest-flow-shell";
import { ProductSelectCard } from "@/components/vaults/product-select-card";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Select a Product — Hearst Yield Vault",
};

export default async function VaultsPage() {
  const investor = await getInvestor();
  const demo = isDemoInvestor(investor);
  const vaults = demo ? buildDemoVaults() : await listVaults();

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
      {/* The InvestFlowShell h1 ("Select a product") IS this region's Level-1
          heading — see DESIGN_SYSTEM §UI-Hierarchy. No redundant section h2:
          the product list is the section body directly under the page thesis. */}
      <section aria-label="Available products">
        {demo ? (
          <DemoDataBanner message={DEMO_SANDBOX_DISCLAIMER} className="mb-[var(--ct-space-4)]" />
        ) : null}
        {vaults.length === 0 ? (
          <AwaitingMetricState
            message="No vault is currently deployed with a verified on-chain contract."
            detail="Products appear here once a vault is live on Base Sepolia with a confirmed deployment address."
          />
        ) : (
          <div className="product-doc-stack">
            {vaults.map((vault) => (
              <ProductSelectCard key={vault.id} vault={vault} demo={demo} />
            ))}
          </div>
        )}
      </section>
    </InvestFlowShell>
  );
}
