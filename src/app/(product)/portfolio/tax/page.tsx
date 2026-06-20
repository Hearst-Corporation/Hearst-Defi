import "../portfolio.css";

import Link from "next/link";

import { loadTaxPreview } from "@/lib/portfolio/tax-preview-loader";
import { PortfolioLeafShell } from "@/components/portfolio/portfolio-leaf-shell";
import {
  TaxPreviewEmpty,
  TaxPreviewPanel,
} from "@/components/portfolio/tax-preview-panel";
import { ProductPageHeader } from "@/components/connect/product-page-header";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Tax preview",
  description: "YTD 1099 and CRS tax preview from your ledger",
};

export default async function PortfolioTaxPage() {
  const year = new Date().getUTCFullYear();
  const preview = await loadTaxPreview(year);

  return (
    <PortfolioLeafShell
      testId="portfolio-tax-page"
      header={
        <ProductPageHeader
          eyebrow="Portfolio"
          title="Tax preview"
          description="YTD interest, cost basis, and CRS indicators from your distributions and positions."
        />
      }
    >
      <div className="pf-tax-page">
        {preview ? (
          <TaxPreviewPanel preview={preview} />
        ) : (
          <TaxPreviewEmpty />
        )}
        <p className="body-xs ct-text-muted m-0">
          <Link className="pf-panel-leaf-link" href="/portfolio/distributions">
            ← Distributions
          </Link>
        </p>
      </div>
    </PortfolioLeafShell>
  );
}
