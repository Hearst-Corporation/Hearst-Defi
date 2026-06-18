import { EmptySurface } from "@/components/ui/empty-surface";
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
    >
      <section aria-label="Available products">
        {demo ? (
          <DemoDataBanner message={DEMO_SANDBOX_DISCLAIMER} className="mb-[var(--ct-space-4)]" />
        ) : null}
        {vaults.length === 0 ? (
          <EmptySurface
            live
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
