// /vaults — Step 1 of 4: Select a product
// Server Component. Single ProductSelectCard at MVP (forward-compatible grid).
// Non-negotiable #9: single vault MVP, no multi-vault abstractions today.

import { ProductPageHeader } from "@/components/connect/product-page-header";
import { listVaults } from "@/lib/data/vaults";
import { ProductSelectCard } from "@/components/vaults/product-select-card";
import { StepProgress } from "@/components/vaults/step-progress";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Select a Product — Hearst Yield Vault",
};

export default async function VaultsPage() {
  const vaults = await listVaults();

  return (
    <div className="space-y-8">
      <ProductPageHeader
        eyebrow="Invest"
        title="Select a product"
        description={
          <p className="body-lg max-w-xl">
            Professional-grade structured yield for qualified investors.
            Review the term sheet and confirm before depositing.
          </p>
        }
      >
        <div className="pt-6">
          <StepProgress active="select" />
        </div>
      </ProductPageHeader>

      {/* Product grid — auto-fit, single card at MVP */}
      <section aria-labelledby="vaults-heading">
        <h2 id="vaults-heading" className="h2 mb-6">
          Available products
        </h2>

        {vaults.length === 0 ? (
          <div
            role="status"
            className="pf-empty-widget flex flex-col items-center justify-center gap-1 px-5 py-12 text-center"
          >
            <p className="body-sm ct-text-muted">No products available right now.</p>
            <p className="body-xs ct-text-faint">
              Check back soon or contact your manager.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {vaults.map((vault) => (
              <ProductSelectCard key={vault.id} vault={vault} />
            ))}
          </div>
        )}
      </section>

      {/* Global disclaimer (#10) */}
      <footer>
        <p className="body-xs ct-text-faint max-w-2xl">
          Products listed are offered exclusively to professional and qualified
          investors. Past performance does not indicate future results. APY
          ranges are not a projection of returns. Subject to minimum
          subscription, jurisdictional restrictions, and soft lock-up terms.
        </p>
      </footer>
    </div>
  );
}
