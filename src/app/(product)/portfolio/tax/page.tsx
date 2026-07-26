// Portfolio › Tax preview — YTD 1099-INT / 1099-B / CRS preview computed from the
// investor's REAL ledger (loadPortfolio + getTaxPreview), on the DS canon.

import { notFound } from "next/navigation";

import { EmptySurface } from "@/components/catalyst/empty-surface";
import { PortfolioLeafHeader } from "@/components/portfolio/portfolio-leaf-header";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { getInvestor } from "@/lib/auth/session";
import { loadPortfolio } from "@/lib/data/portfolio";
import { daysHeldSince } from "@/lib/engine/lp-pnl";
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
const KPI_VALUE = "ct-metric-value text-[length:var(--ct-text-2xl)]";
// Placeholder for a figure the platform does not compute. Never a "$0.00" — a
// zero on a tax surface reads as a measured "you earned nothing this year".
const NOT_CALCULATED = "—";

export default async function PortfolioTaxPage() {
  const investor = await getInvestor();
  if (!investor) notFound();

  const { positions, deployedUsdc } = await loadPortfolio();

  // Real holding period, from the oldest active subscription — drives the
  // 1099-B short-term/long-term split instead of a hardcoded 180 days.
  const now = new Date();
  const oldestSubscribedAt = positions.reduce<Date | null>(
    (oldest, p) =>
      oldest && oldest.getTime() <= p.subscribedAt.getTime()
        ? oldest
        : p.subscribedAt,
    null,
  );

  // INTEREST INCOME IS NOT REPORTED HERE — deliberately.
  //
  // `loadPortfolio()` exposes `totalYieldYtdUsdc` and `accruedYieldUsdc`, both of
  // which are built on `Position.accruedYieldUsdc`. That column is never computed
  // by any business process — the only writers are demo fixtures — so in
  // production it holds its `@default(0)`. Series 1 is moreover a BTC-ACCUMULATION
  // note with no yield at all: /portfolio/yield and /portfolio/distributions are
  // already retired redirects. Feeding those values into a 1099-INT preview would
  // declare a $0.00 interest income as a *measured* tax figure to the investor.
  //
  // We therefore pass 0 for the two yield-derived overrides (they keep
  // `dataSource: "live"`, so the deterministic seeded stub — which WOULD fabricate
  // a five-figure interest income — never kicks in) and the 1099-INT / CRS
  // interest tiles below render an explicit "not calculated" instead of a number.
  // Only `actualPrincipalUsd` (real, attested at subscription) is reported.
  const preview = getTaxPreview(investor.userId, TAX_YEAR, {
    actualInterestIncomeUsd: 0,
    actualPrincipalUsd: deployedUsdc,
    actualAccruedYieldUsd: 0,
    // Real days held when the investor holds a position; omitted otherwise so
    // no fabricated holding period is presented (the split is 0 with no gain).
    ...(oldestSubscribedAt
      ? { actualDaysHeld: daysHeldSince(oldestSubscribedAt, now) }
      : {}),
    // True data-currency date for the "as of" caption — not a hardcoded day.
    ytdCutDate: now.toISOString().slice(0, 10),
    // residenceCountry intentionally omitted: the Investor record carries no
    // residence field, so we never fabricate a jurisdiction (CRS block below
    // hides the residence attribution when it is unknown).
  });
  const { form1099Int, form1099B, crs } = preview;

  // No active position → there is no real ledger to preview from. loadPortfolio
  // still returns defined (zero) totals for an empty ledger, which would flip
  // getTaxPreview's `isLive` check to true and render a false "estimated" badge
  // over all-zero figures. Gate on the actual position count instead, and show
  // an honest empty state — never a fabricated $0.00 tax preview.
  const hasPositions = positions.length > 0;

  // These YTD/CRS figures are always a preview — "estimated" when computed from
  // the real ledger, "simulated" when the deterministic sandbox stub was used.
  const provenanceKind = preview.dataSource === "live" ? "estimated" : "simulated";

  return (
    <div className="flex flex-col rounded-2xl border border-[var(--ct-border)] bg-surface-page mb-8">
      <div className="p-5 lg:p-6 flex flex-col gap-y-5">
        <PortfolioLeafHeader
          titleLead="Tax"
          titleAccent="Preview"
          kicker={`YTD · ${TAX_YEAR} · PREVIEW ONLY`}
        />

        {hasPositions ? (
          <>
            {/* 1099-INT */}
            <section className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-[var(--ct-shadow-soft)] flex flex-col overflow-hidden">
              <div className="p-5 border-b border-[var(--ct-border-soft)] flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="ct-section-title">Form 1099-INT</h2>
                  <p className="ct-metric-caption">
                    Interest income · as of {form1099Int.ytdCutDate}
                  </p>
                </div>
                <ProvenanceBadge kind={provenanceKind} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-[var(--ct-border-soft)]">
                <div className={KPI_TILE}>
                  <div className="ct-bento-label">Box 1 · Interest income</div>
                  {/* Not a number: the platform computes no interest income for
                      this note (accumulation product, no yield accrual process).
                      Printing $0.00 here would assert a measured tax figure. */}
                  <div className={KPI_VALUE}>{NOT_CALCULATED}</div>
                  <p className="ct-metric-caption">
                    Not calculated — Series 1 accumulates BTC and pays no
                    interest. Any reportable amount is determined at redemption.
                  </p>
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
            <section className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-[var(--ct-shadow-soft)] flex flex-col overflow-hidden">
              <div className="p-5 border-b border-[var(--ct-border-soft)] flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="ct-section-title">Form 1099-B</h2>
                  <p className="ct-metric-caption">
                    Proceeds &amp; cost basis · capital gains on redemption only
                  </p>
                </div>
                <ProvenanceBadge kind={provenanceKind} />
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
                {/* The ST/LT split is `compute1099B`'s allocation of the accrued
                    yield balance — a column that is never computed (see above).
                    With no disposition and no accrual engine there is no notional
                    gain to split, so both tiles state that rather than show $0.00
                    as a settled result. The holding-period label stays real: it
                    comes from the oldest subscription date. */}
                <div className={KPI_TILE}>
                  <div className="ct-bento-label">Short-term gain/loss</div>
                  <div className={KPI_VALUE}>{NOT_CALCULATED}</div>
                  <p className="ct-metric-caption">
                    Not calculated — no disposition recorded.
                  </p>
                </div>
                <div className={KPI_TILE}>
                  <div className="ct-bento-label">Long-term gain/loss</div>
                  <div className={KPI_VALUE}>{NOT_CALCULATED}</div>
                  <p className="ct-metric-caption">
                    Not calculated — no disposition recorded.
                  </p>
                </div>
              </div>
            </section>

            {/* CRS */}
            <section className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-[var(--ct-shadow-soft)] flex flex-col overflow-hidden">
              <div className="p-5 border-b border-[var(--ct-border-soft)] flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="ct-section-title">CRS preview</h2>
                  <p className="ct-metric-caption">
                    Common Reporting Standard
                    {crs.residenceCountry
                      ? ` · residence ${crs.residenceCountry}`
                      : null}
                  </p>
                </div>
                <ProvenanceBadge kind={provenanceKind} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-[var(--ct-border-soft)]">
                <div className={KPI_TILE}>
                  <div className="ct-bento-label">Account balance</div>
                  <div className={KPI_VALUE}>
                    {formatUsdFull(crs.accountBalanceUsd)}
                  </div>
                </div>
                {/* CRS gross interest mirrors the 1099-INT box 1 figure, so it
                    inherits the same problem — it is not computed. Reported as
                    unavailable rather than as a zero credited amount. */}
                <div className={KPI_TILE}>
                  <div className="ct-bento-label">Gross interest</div>
                  <div className={KPI_VALUE}>{NOT_CALCULATED}</div>
                  <p className="ct-metric-caption">
                    Not calculated — no interest is credited on this note.
                  </p>
                </div>
              </div>
            </section>
          </>
        ) : (
          <EmptySurface
            message="No tax preview yet"
            detail="You have no active position — 1099-INT, 1099-B and CRS figures populate once you hold a position with real ledger activity."
            ariaLabel="No tax preview: no active position"
          />
        )}

        <p className="ct-metric-caption px-1">
          Preview only — final tax documents are issued annually. Not tax advice.
          Interest-income and gain/loss lines are shown as not calculated: Series 1
          is a BTC-accumulation note that credits no interest, and the platform
          runs no yield-accrual process. Only cost basis is reported from your
          ledger.
        </p>
      </div>
    </div>
  );
}
