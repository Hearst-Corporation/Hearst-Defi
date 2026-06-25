import {
  PfCockpitPanel,
  PfCockpitPanelHeader,
} from "@/components/portfolio/pf-cockpit-panel";
import type { YieldSource } from "@/components/portfolio/yield-stack";
import type { AllocationBucketSlice } from "@/lib/data/portfolio";
import { formatUsdCompact } from "@/lib/vaults/product-display";
import { resolveProvenance } from "@/lib/portfolio/provenance";
import { PortfolioLeafLink } from "@/components/portfolio/portfolio-leaf-link";
import { ApyRange } from "@/components/ui/apy-range";
import { METHODOLOGY_VERSION } from "@/lib/engine/methodology";
import { cn } from "@/lib/cn";

/**
 * Capital & Yield — Premium V4 instrument panel.
 *
 * Data-driven, no fake elements, no invented numbers.
 * Three honest states: live (data + position), awaiting-data (position active
 * but vault snapshot not yet available), empty (no position yet).
 *
 * Pure Server Component. No "use client". No Date.now() / Math.random().
 *
 * CLAUDE.md non-negotiables:
 *   #1  — APY always a range (via <ApyRange>)
 *   #2  — Provenance badge when data is real
 *   #5  — Forbidden words absent
 *   #10 — "not guaranteed" disclaimer when showing projection
 */

export interface CapitalYieldProps {
  sources: YieldSource[];
  blendedLow: number;
  blendedHigh: number;
  stressedBearRange: { low: number; high: number };
  buckets: AllocationBucketSlice[];
  totalValueUsdc: number;
  methodologyVersion?: string;
  source?: "live" | "estimated" | "stale";
  updatedAt?: Date;
  leafHref?: string;
  embedded?: boolean;
  /**
   * True when the investor holds at least one confirmed active position.
   * Distinguishes two empty states that must NOT share copy:
   *   (a) no position → "subscribe first" / "confirmed on-chain" pending
   *   (b) position active but vault allocation/yield snapshot not yet available
   */
  hasActivePosition?: boolean;
}

/**
 * Monochrome-green bucket palette for allocation bars.
 * Derivations via color-mix — no raw hex/rgb in TSX.
 */
const BUCKET_BAR_COLOR: Record<YieldSource["bucket"], string> = {
  mining: "var(--ct-accent)",
  usdc_base: "color-mix(in srgb, var(--ct-accent) 70%, var(--ct-text-neutral))",
  btc_tactical: "color-mix(in srgb, var(--ct-accent) 50%, var(--ct-text-neutral))",
  stable_reserve: "color-mix(in srgb, var(--ct-accent) 32%, var(--ct-text-neutral))",
};

export function CapitalYield({
  sources,
  blendedLow,
  blendedHigh,
  buckets,
  totalValueUsdc,
  methodologyVersion = METHODOLOGY_VERSION,
  source = "estimated",
  updatedAt,
  leafHref,
  embedded = false,
  hasActivePosition = false,
}: CapitalYieldProps) {
  const maxAbsContribution = sources.reduce(
    (acc, s) => Math.max(acc, Math.abs(s.contributionPct)),
    0,
  );

  // LIVE: we have vault allocation + real data + investor position
  const hasData =
    sources.length > 0 &&
    buckets.length > 0 &&
    totalValueUsdc > 0 &&
    maxAbsContribution > 0;

  // Two distinct empty states — never same copy (historical incoherence):
  //   awaiting-data: position confirmed on-chain, vault snapshot not yet cached
  //   no-position:   investor has not subscribed yet
  const emptyReason: "no-position" | "awaiting-data" =
    hasActivePosition && totalValueUsdc > 0 ? "awaiting-data" : "no-position";

  const provenance =
    hasData
      ? resolveProvenance(source, updatedAt ?? new Date(), "estimated")
      : undefined;

  const [rLow, rHigh] =
    blendedLow <= blendedHigh ? [blendedLow, blendedHigh] : [blendedHigh, blendedLow];

  return (
    <PfCockpitPanel
      variant="wide"
      chrome={embedded ? "embedded" : "panel"}
      aria-label="Capital and yield — allocation and 12 month forward yield"
      className={embedded ? "pf-capital-yield--embedded" : "cy-panel"}
    >
      <PfCockpitPanelHeader
        title="Capital & Yield"
        subtitle={hasData ? "Active capital · 12m forward yield" : undefined}
        provenance={provenance}
        titleVariant="primary"
        trailing={leafHref ? <PortfolioLeafLink href={leafHref} /> : undefined}
      />

      {hasData ? (
        <div className="cy-v4-body">
          {/* ── Hero metrics row ── */}
          <div className="cy-v4-metrics">
            {/* Capital deployed */}
            <div className="cy-v4-metric">
              <span className="cy-v4-metric__label">Capital active</span>
              <span className="cy-v4-metric__value tabular">
                {formatUsdCompact(totalValueUsdc)}
              </span>
            </div>

            {/* APY range — NON-NEGOTIABLE: always a range (#1) */}
            <div className="cy-v4-metric cy-v4-metric--accent">
              <span className="cy-v4-metric__label">Target APY</span>
              <span className="cy-v4-metric__value">
                <ApyRange
                  low={rLow}
                  high={rHigh}
                  className="font-bold ct-text-accent tabular"
                />
              </span>
            </div>
          </div>

          {/* ── Allocation bars (replaces donut) ── */}
          <div className="cy-v4-alloc" aria-label="Allocation by bucket">
            <p
              className="cy-v4-alloc__head"
              aria-hidden="true"
            >
              Allocation
            </p>

            {/* Segmented allocation bar */}
            <div className="cy-v4-bar-track" role="img" aria-label="Allocation segments">
              {(() => {
                // Defensive normalisation: if imperfect data pushes sum > 100 the last
                // segments would be clipped by overflow:hidden + flex-shrink:0.
                // When total > 100 we scale widths proportionally so they always fit.
                // The displayed pct values in the legend are left untouched (real data).
                const totalPct = buckets.reduce((sum, b) => sum + b.pct, 0);
                return buckets.map((b) => {
                  const segWidth = totalPct > 100 ? (b.pct / totalPct) * 100 : b.pct;
                  return (
                    <div
                      key={b.bucket}
                      className="cy-v4-bar-seg"
                      style={{
                        width: `${segWidth}%`,
                        background: BUCKET_BAR_COLOR[b.bucket],
                      }}
                      aria-label={`${b.bucket} ${b.pct}%`}
                    />
                  );
                });
              })()}
            </div>

            {/* Per-bucket legend with contribution */}
            <ul className="cy-v4-bucket-list" aria-label="Bucket breakdown">
              {buckets.map((b) => {
                const src = sources.find((s) => s.bucket === b.bucket);
                const contribution = src?.contributionPct ?? null;
                const contrib =
                  contribution !== null
                    ? contribution < 0
                      ? `−${Math.abs(contribution).toFixed(1)}%`
                      : `+${contribution.toFixed(1)}%`
                    : null;

                return (
                  <li key={b.bucket} className="cy-v4-bucket-row">
                    <span
                      className="cy-v4-bucket-dot"
                      style={{ background: BUCKET_BAR_COLOR[b.bucket] }}
                      aria-hidden="true"
                    />
                    <span className="cy-v4-bucket-label">
                      {src?.label ?? b.bucket}
                    </span>
                    <span className="cy-v4-bucket-pct tabular">{b.pct}%</span>
                    {contrib !== null ? (
                      <span
                        className={cn(
                          "cy-v4-bucket-contrib tabular",
                          src?.isVolatile && "cy-v4-bucket-contrib--volatile",
                        )}
                      >
                        {src?.isVolatile
                          ? `±${Math.abs(src.contributionPct).toFixed(1)}%`
                          : contrib}
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>

          {/* ── Disclaimer — non-negotiable #10 ── */}
          <p className="cy-v4-disclaimer" role="note">
            Conditional projection — not guaranteed ·{" "}
            {methodologyVersion.startsWith("v")
              ? methodologyVersion
              : `v${methodologyVersion}`}
          </p>
        </div>
      ) : (
        <div className="cy-v4-empty">
          {emptyReason === "awaiting-data" ? (
            <>
              <p className="cy-v4-empty__lead">Your position is active.</p>
              <p className="cy-v4-empty__sub">
                Allocation and projected yield will display as soon as the latest
                vault breakdown is published.
              </p>
            </>
          ) : (
            <>
              <p className="cy-v4-empty__lead">Position not yet confirmed.</p>
              <p className="cy-v4-empty__sub">
                Allocation and projected yield appear once your first position is
                confirmed on-chain.
              </p>
            </>
          )}
        </div>
      )}
    </PfCockpitPanel>
  );
}
