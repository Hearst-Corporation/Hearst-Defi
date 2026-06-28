// Portfolio › Tax preview — YTD 1099-INT / 1099-B / CRS preview computed from the
// investor's REAL ledger (loadPortfolio + getTaxPreview), on the DS canon.

import { notFound } from "next/navigation";

import { PortfolioLeafHeader } from "@/components/portfolio/portfolio-leaf-header";
import { getInvestor } from "@/lib/auth/session";
import { loadPortfolio } from "@/lib/data/portfolio";
import { getTaxPreview } from "@/lib/portfolio/tax";
import { formatUsdFull } from "@/lib/vaults/product-display";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Tax preview",
  description: "YTD 1099 and CRS tax preview from your ledger",
};

// Reporting year for the preview. Final documents are issued annually; this is
// a YTD preview only (docStatus = "preview").
const TAX_YEAR = 2026;

const KPI_TILE = "flex flex-col gap-1.5 bg-surface-card p-5 min-w-0";
const KPI_VALUE = "ct-metric-value text-[length:var(--ct-text-lg)]";

export default async function PortfolioTaxPage() {
  const investor = await getInvestor();
  if (!investor) notFound();

  const { deployedUsdc, accruedYieldUsdc, totalYieldYtdUsdc } =
    await loadPortfolio();

  const preview = getTaxPreview(investor.userId, TAX_YEAR, {
    actualInterestIncomeUsd: totalYieldYtdUsdc,
    actualPrincipalUsd: deployedUsdc,
    actualAccruedYieldUsd: accruedYieldUsdc,
  });
  const { form1099Int, form1099B, crs } = preview;

  return (
    <div className="dark flex flex-col rounded-2xl border border-[var(--ct-border)] bg-surface-page mb-8">
      <div className="p-5 lg:p-6 flex flex-col gap-y-5">
        <PortfolioLeafHeader
          titleLead="Tax"
          titleAccent="Preview"
          kicker={`YTD · ${TAX_YEAR} · PREVIEW ONLY`}
        />

        {/* 1099-INT */}
        <section className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-sm flex flex-col overflow-hidden">
          <div className="p-5 border-b border-[var(--ct-border-soft)]">
            <h2 className="ct-section-title">Form 1099-INT</h2>
            <p className="ct-metric-caption">
              Interest income · as of {form1099Int.ytdCutDate}
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-[var(--ct-border-soft)]">
            <div className={KPI_TILE}>
              <div className="ct-bento-label">Box 1 · Interest income</div>
              <div className={KPI_VALUE}>
                {formatUsdFull(form1099Int.interestIncomeUsd)}
              </div>
            </div>
            <div className={KPI_TILE}>
              <div className="ct-bento-label">Box 4 · Federal withheld</div>
              <div className={KPI_VALUE}>
                {formatUsdFull(form1099Int.federalTaxWithheldUsd)}
              </div>
            </div>
          </div>
        </section>

        {/* 1099-B */}
        <section className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-sm flex flex-col overflow-hidden">
          <div className="p-5 border-b border-[var(--ct-border-soft)]">
            <h2 className="ct-section-title">Form 1099-B</h2>
            <p className="ct-metric-caption">
              Proceeds &amp; cost basis · capital gains on redemption only
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-[var(--ct-border-soft)]">
            <div className={KPI_TILE}>
              <div className="ct-bento-label">Box 1e · Cost basis</div>
              <div className={KPI_VALUE}>
                {formatUsdFull(form1099B.costBasisUsd)}
              </div>
            </div>
            <div className={KPI_TILE}>
              <div className="ct-bento-label">Box 1d · Proceeds</div>
              <div className={KPI_VALUE}>
                {formatUsdFull(form1099B.proceedsUsd)}
              </div>
            </div>
            <div className={KPI_TILE}>
              <div className="ct-bento-label">Short-term gain/loss</div>
              <div className={KPI_VALUE}>
                {formatUsdFull(form1099B.shortTermGainLossUsd)}
              </div>
            </div>
            <div className={KPI_TILE}>
              <div className="ct-bento-label">Long-term gain/loss</div>
              <div className={KPI_VALUE}>
                {formatUsdFull(form1099B.longTermGainLossUsd)}
              </div>
            </div>
          </div>
        </section>

        {/* CRS */}
        <section className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-sm flex flex-col overflow-hidden">
          <div className="p-5 border-b border-[var(--ct-border-soft)]">
            <h2 className="ct-section-title">CRS preview</h2>
            <p className="ct-metric-caption">
              Common Reporting Standard · residence {crs.residenceCountry}
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-[var(--ct-border-soft)]">
            <div className={KPI_TILE}>
              <div className="ct-bento-label">Account balance</div>
              <div className={KPI_VALUE}>
                {formatUsdFull(crs.accountBalanceUsd)}
              </div>
            </div>
            <div className={KPI_TILE}>
              <div className="ct-bento-label">Gross interest</div>
              <div className={KPI_VALUE}>
                {formatUsdFull(crs.grossInterestUsd)}
              </div>
            </div>
          </div>
        </section>

        <p className="ct-metric-caption px-1">
          Preview only — final tax documents are issued annually. Not tax advice.
        </p>
      </div>
    </div>
  );
}
