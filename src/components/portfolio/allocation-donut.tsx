import {
  PfCockpitPanel,
  PfCockpitPanelHeader,
} from "@/components/portfolio/pf-cockpit-panel";
import {
  ALLOCATION_DASH_TONE,
  ALLOCATION_LABELS,
} from "@/lib/allocation-colors";
import type { AllocationBucketSlice } from "@/lib/data/portfolio";
import type { Provenance } from "@/components/ui/provenance-badge";
import { formatUsdCompact } from "@/lib/vaults/product-display";
import { resolveProvenance } from "@/lib/portfolio/provenance";

interface AllocationDonutProps {
  /** Allocation slices by yield bucket (mining / btc_tactical / usdc_base / stable_reserve). */
  buckets: AllocationBucketSlice[];
  totalValueUsdc: number;
  source: "live" | "stale";
  updatedAt?: Date;
  /** Render donut shell at $0 (layout preview, no allocation). */
  previewZeros?: boolean;
}

export function AllocationDonut({
  buckets,
  totalValueUsdc,
  source,
  updatedAt,
  previewZeros = false,
}: AllocationDonutProps) {
  const isPreviewShell =
    previewZeros || totalValueUsdc === 0 || buckets.length === 0;
  const provenance: Provenance | undefined = isPreviewShell
    ? undefined
    : resolveProvenance(source, updatedAt, "estimated");

  // Canonical donut convention (r=15.9155 → C=100, pct maps 1:1 to dasharray):
  // dashArray = `${pct} ${100 - pct}`, dashOffset = -running cumulative.
  // Each arc starts where the previous ended. The allocation `pct` is the vault
  // mix; the $ value shown is that mix applied to THIS investor's holding
  // (totalValueUsdc), not the vault-wide bucket value. dashOffset derived from
  // the prefix sum so the reduce stays pure (no mutated outer accumulator).
  const segments = buckets.map((slice, i) => {
    const priorPct = buckets
      .slice(0, i)
      .reduce((sum, b) => sum + b.pct, 0);
    return {
      ...slice,
      investorValueUsdc: (totalValueUsdc * slice.pct) / 100,
      dashOffset: -priorPct,
    };
  });

  const hasAllocation = !isPreviewShell && segments.length > 0;

  return (
    <PfCockpitPanel variant="compact" aria-label="Portfolio allocation">
      <PfCockpitPanelHeader
        title="Allocation"
        subtitle="By yield source"
        provenance={provenance}
      />

      <div className="pf-allocation-donut flex min-h-0 flex-1 flex-col items-center">
        <div className="pf-allocation-donut-body flex min-h-0 w-full flex-1 flex-col items-center justify-center">
          <div className="pf-allocation-donut-chart dash-chart-container relative m-0 w-[var(--ct-donut-size)] h-[var(--ct-donut-size)]">
            <svg
              className="dash-chart-svg w-full h-full"
              viewBox="0 0 42 42"
              role="img"
              aria-label={
                hasAllocation
                  ? "Allocation by yield source"
                  : "Allocation by yield source — preview at zero, no positions"
              }
            >
              <circle
                className="dash-chart-circle"
                cx="21"
                cy="21"
                r="15.9155"
                stroke="var(--ct-surface-3)"
                strokeDasharray="100 0"
              />
              {hasAllocation
                ? segments.map((s) => (
                    <circle
                      key={s.bucket}
                      className={`dash-chart-circle color-${ALLOCATION_DASH_TONE[s.bucket]}`}
                      cx="21"
                      cy="21"
                      r="15.9155"
                      strokeDasharray={`${s.pct.toFixed(2)} ${(100 - s.pct).toFixed(2)}`}
                      strokeDashoffset={s.dashOffset.toFixed(2)}
                    />
                  ))
                : null}
            </svg>
            <div className="donut-center">
              <span className="donut-val">
                {isPreviewShell ? "—" : formatUsdCompact(totalValueUsdc)}
              </span>
              <span className="donut-lbl">Portfolio</span>
            </div>
          </div>

          {hasAllocation ? (
            <div className="dash-legend w-full mt-0">
              {segments.map((s) => (
                <div key={s.bucket} className="dash-legend-row">
                  <span className="dash-legend-left">
                    <span
                      className={`dash-legend-dot dot-${ALLOCATION_DASH_TONE[s.bucket]}`}
                    />
                    {ALLOCATION_LABELS[s.bucket] ?? s.bucket}
                  </span>
                  <span className="dash-legend-val">
                    {s.pct.toFixed(0)}% · {formatUsdCompact(s.investorValueUsdc)}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </PfCockpitPanel>
  );
}
