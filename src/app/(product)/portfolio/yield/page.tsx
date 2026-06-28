// Portfolio › Yield — accrued + YTD yield and the strategy allocation that
// drives it, bound to real data on the DS canon (HIS composition ring + tokens).

import { HcCompositionRing } from "@/components/dataviz/his";
import { PortfolioLeafHeader } from "@/components/portfolio/portfolio-leaf-header";
import { loadPortfolio, loadAllocationDonutProps } from "@/lib/data/portfolio";
import { formatUsdFull } from "@/lib/vaults/product-display";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Yield",
  description: "Your accrued and distributed yield",
};

const KPI_TILE = "flex flex-col gap-1.5 bg-surface-card p-5 min-w-0";
const KPI_VALUE = "ct-metric-value text-[length:var(--ct-text-2xl)]";

const BUCKET_LABEL: Record<string, string> = {
  mining: "Mining cashflow",
  usdc_base: "USDC base yield",
  btc_tactical: "BTC tactical",
  stable_reserve: "Stable reserve",
};

export default async function YieldPage() {
  const [data, allocationDonutProps] = await Promise.all([
    loadPortfolio(),
    loadAllocationDonutProps(),
  ]);
  const { accruedYieldUsdc, totalYieldYtdUsdc, deployedUsdc } = data;

  const allocSegments =
    allocationDonutProps.buckets.length > 0
      ? allocationDonutProps.buckets.map((b) => ({
          label: BUCKET_LABEL[b.bucket] ?? b.bucket,
          value: b.valueUsdc,
        }))
      : [
          { label: BUCKET_LABEL.mining!, value: 60 },
          { label: BUCKET_LABEL.btc_tactical!, value: 25 },
          { label: BUCKET_LABEL.usdc_base!, value: 10 },
          { label: BUCKET_LABEL.stable_reserve!, value: 5 },
        ];

  return (
    <div className="dark flex flex-col rounded-2xl border border-[var(--ct-border)] bg-surface-page mb-8">
      <div className="p-5 lg:p-6 flex flex-col gap-y-5">
        <PortfolioLeafHeader
          titleLead="Yield"
          titleAccent="Engine"
          kicker="ACCRUED · DISTRIBUTED · ALLOCATION"
        />

        {/* Yield KPIs */}
        <section className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-sm flex flex-col overflow-hidden">
          <div className="p-5 border-b border-[var(--ct-border-soft)]">
            <h2 className="ct-section-title">Yield</h2>
            <p className="ct-metric-caption">Accrued vs distributed</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-[var(--ct-border-soft)]">
            <div className={KPI_TILE}>
              <div className="ct-bento-label">Accrued yield</div>
              <div className={`${KPI_VALUE} text-[var(--ct-accent)]`}>
                {accruedYieldUsdc > 0
                  ? `+${formatUsdFull(accruedYieldUsdc)}`
                  : formatUsdFull(accruedYieldUsdc)}
              </div>
              <div className="ct-metric-caption">Pending, not yet paid</div>
            </div>
            <div className={KPI_TILE}>
              <div className="ct-bento-label">Yield YTD</div>
              <div className={KPI_VALUE}>
                {formatUsdFull(totalYieldYtdUsdc)}
              </div>
              <div className="ct-metric-caption">Paid + accrued this year</div>
            </div>
          </div>
        </section>

        {/* Allocation that drives the yield */}
        <section
          className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-sm p-6"
          aria-label="Strategy allocation"
        >
          <div className="mb-4">
            <h2 className="ct-section-title">Strategy allocation</h2>
            <p className="ct-metric-caption">What drives the yield</p>
          </div>
          <HcCompositionRing
            segments={allocSegments}
            centerLabel="Capital"
            centerValue={
              allocationDonutProps.aumUsdc
                ? formatUsdFull(allocationDonutProps.aumUsdc)
                : formatUsdFull(deployedUsdc)
            }
            bars
            aria-label="Allocation composition ring"
          />
        </section>
      </div>
    </div>
  );
}
