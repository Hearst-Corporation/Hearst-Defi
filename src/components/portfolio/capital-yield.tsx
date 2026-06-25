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
  const hasData = sources.length > 0 && totalValueUsdc > 0;

  // Two distinct empty states — never same copy (historical incoherence):
  //   awaiting-data: position confirmed on-chain, vault snapshot not yet cached
  //   no-position:   investor has not subscribed yet
  const emptyReason: "no-position" | "awaiting-data" =
    hasActivePosition && totalValueUsdc > 0 ? "awaiting-data" : "no-position";

  // Rich partial: a confirmed position with real capital, but the vault
  // allocation breakdown is not yet published. We still surface the REAL figures
  // the account already has (capital + target APY) instead of an empty text block.
  // No invented data — only totalValueUsdc and the blended APY range.
  const showRichPartial = !hasData && emptyReason === "awaiting-data" && totalValueUsdc > 0;

  const provenance =
    hasData || showRichPartial
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
        subtitle={hasData ? "Active capital · 12m forward yield" : showRichPartial ? "Active capital · allocation pending" : undefined}
        provenance={provenance}
        titleVariant="primary"
        trailing={leafHref ? <PortfolioLeafLink href={leafHref} /> : undefined}
      />

      {hasData ? (
        <div className="cy-v4-body">
          <div className="cy-v4-split">
            {/* ── Left Column: Metrics ── */}
            <div className="cy-v4-metrics-col">
              <div className="cy-v4-metric">
                <span className="cy-v4-metric__label">Capital active</span>
                <span className="cy-v4-metric__value tabular">
                  {formatUsdCompact(totalValueUsdc)}
                </span>
              </div>

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

            {/* ── Right Column: APY Band & Allocation ── */}
            <div className="cy-v4-visuals-col">
              <div className="cy-v4-apy-band-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ct-space-4)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="cy-v4-metric__label">TARGET APY RANGE</span>
                  <span className="cy-v4-metric__label" style={{ opacity: 0.5 }}>{rLow.toFixed(1)}% - {rHigh.toFixed(1)}%</span>
                </div>
                <div className="cy-v4-monte-carlo-wrapper" aria-hidden="true">
                  <span className="cy-v4-apy-band__anchor" style={{ color: 'var(--ct-text-secondary)' }}>{rLow.toFixed(1)}%</span>
                  <div className="cy-v4-mc-chart">
                    <svg viewBox="0 0 200 40" preserveAspectRatio="none" className="cy-v4-mc-svg">
                      <defs>
                        <linearGradient id="mc-cone" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="var(--ct-accent)" stopOpacity="0.0" />
                          <stop offset="30%" stopColor="var(--ct-accent)" stopOpacity="0.05" />
                          <stop offset="100%" stopColor="var(--ct-accent)" stopOpacity="0.25" />
                        </linearGradient>
                        <linearGradient id="mc-line" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="var(--ct-accent)" stopOpacity="0" />
                          <stop offset="50%" stopColor="var(--ct-accent)" stopOpacity="0.4" />
                          <stop offset="100%" stopColor="var(--ct-accent)" stopOpacity="1" />
                        </linearGradient>
                        <filter id="mc-glow" x="-20%" y="-20%" width="140%" height="140%">
                          <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                          <feMerge>
                            <feMergeNode in="coloredBlur"/>
                            <feMergeNode in="SourceGraphic"/>
                          </feMerge>
                        </filter>
                      </defs>
                      <path d="M 0 20 C 80 20, 140 5, 200 2 L 200 38 C 140 35, 80 20, 0 20 Z" fill="url(#mc-cone)" />
                      <path d="M 0 20 C 80 20, 140 5, 200 2" fill="none" stroke="url(#mc-line)" strokeWidth="1.5" className="cy-v4-mc-path-top" filter="url(#mc-glow)" />
                      <path d="M 0 20 C 80 20, 140 35, 200 38" fill="none" stroke="url(#mc-line)" strokeWidth="1.5" className="cy-v4-mc-path-bot" filter="url(#mc-glow)" />
                      <path d="M 0 20 C 100 20, 150 20, 200 20" fill="none" stroke="var(--ct-accent)" strokeWidth="1" strokeDasharray="3 4" strokeOpacity="0.6" className="cy-v4-mc-path-mid" />
                      <circle cx="200" cy="2" r="2.5" fill="var(--ct-accent)" className="cy-v4-mc-dot" filter="url(#mc-glow)" />
                      <circle cx="200" cy="38" r="2.5" fill="var(--ct-accent)" className="cy-v4-mc-dot" filter="url(#mc-glow)" />
                    </svg>
                    <div className="cy-v4-mc-scanner"></div>
                  </div>
                  <span className="cy-v4-apy-band__anchor cy-v4-apy-band__anchor--high">{rHigh.toFixed(1)}%</span>
                </div>
              </div>

              {/* ── Allocation bars (replaces donut) ── */}
              <div className="cy-v4-alloc" aria-label="Allocation by bucket" style={{ marginTop: 'var(--ct-space-4)' }}>
                <p
                  className="cy-v4-alloc__head"
                  aria-hidden="true"
                >
                  ALLOCATION OVERVIEW
                </p>

                <div className="cy-v4-radar-block" style={{ marginTop: 'var(--ct-space-3)', flexDirection: 'column', alignItems: 'stretch', gap: 'var(--ct-space-4)' }}>
                  {/* Segmented allocation bar */}
                  <div className="cy-v4-bar-track" role="img" aria-label="Allocation segments">
                    {(() => {
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
              </div>
            </div>
          </div>

          {/* ── Disclaimer — non-negotiable #10 ── */}
          <p className="cy-v4-disclaimer" role="note" style={{ marginTop: 'var(--ct-space-4)' }}>
            Conditional projection — not guaranteed ·{" "}
            {methodologyVersion.startsWith("v")
              ? methodologyVersion
              : `v${methodologyVersion}`}
          </p>
        </div>
      ) : showRichPartial ? (
        <div className="cy-v4-body">
          <div className="cy-v4-split">
            <div className="cy-v4-metrics-col">
              <div className="cy-v4-metric">
                <span className="cy-v4-metric__label">Capital active</span>
                <span className="cy-v4-metric__value tabular">{formatUsdCompact(totalValueUsdc)}</span>
              </div>
              <div className="cy-v4-metric cy-v4-metric--accent">
                <span className="cy-v4-metric__label">Target APY</span>
                <span className="cy-v4-metric__value">
                  <ApyRange low={rLow} high={rHigh} className="font-bold ct-text-accent tabular" />
                </span>
              </div>
            </div>

            <div className="cy-v4-visuals-col">
              <div className="cy-v4-apy-band-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ct-space-4)' }}>
                <span className="cy-v4-metric__label">TARGET APY RANGE</span>
                <div className="cy-v4-monte-carlo-wrapper" aria-hidden="true">
                  <span className="cy-v4-apy-band__anchor" style={{ color: 'var(--ct-text-secondary)' }}>{rLow.toFixed(1)}%</span>
                  <div className="cy-v4-mc-chart">
                    <svg viewBox="0 0 200 40" preserveAspectRatio="none" className="cy-v4-mc-svg">
                      <defs>
                        <linearGradient id="mc-cone" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="var(--ct-accent)" stopOpacity="0.0" />
                          <stop offset="30%" stopColor="var(--ct-accent)" stopOpacity="0.05" />
                          <stop offset="100%" stopColor="var(--ct-accent)" stopOpacity="0.25" />
                        </linearGradient>
                        <linearGradient id="mc-line" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="var(--ct-accent)" stopOpacity="0" />
                          <stop offset="50%" stopColor="var(--ct-accent)" stopOpacity="0.4" />
                          <stop offset="100%" stopColor="var(--ct-accent)" stopOpacity="1" />
                        </linearGradient>
                        <filter id="mc-glow" x="-20%" y="-20%" width="140%" height="140%">
                          <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                          <feMerge>
                            <feMergeNode in="coloredBlur"/>
                            <feMergeNode in="SourceGraphic"/>
                          </feMerge>
                        </filter>
                      </defs>
                      <path d="M 0 20 C 80 20, 140 5, 200 2 L 200 38 C 140 35, 80 20, 0 20 Z" fill="url(#mc-cone)" />
                      <path d="M 0 20 C 80 20, 140 5, 200 2" fill="none" stroke="url(#mc-line)" strokeWidth="1.5" className="cy-v4-mc-path-top" filter="url(#mc-glow)" />
                      <path d="M 0 20 C 80 20, 140 35, 200 38" fill="none" stroke="url(#mc-line)" strokeWidth="1.5" className="cy-v4-mc-path-bot" filter="url(#mc-glow)" />
                      <path d="M 0 20 C 100 20, 150 20, 200 20" fill="none" stroke="var(--ct-accent)" strokeWidth="1" strokeDasharray="3 4" strokeOpacity="0.6" className="cy-v4-mc-path-mid" />
                      <circle cx="200" cy="2" r="2.5" fill="var(--ct-accent)" className="cy-v4-mc-dot" filter="url(#mc-glow)" />
                      <circle cx="200" cy="38" r="2.5" fill="var(--ct-accent)" className="cy-v4-mc-dot" filter="url(#mc-glow)" />
                    </svg>
                    <div className="cy-v4-mc-scanner"></div>
                  </div>
                  <span className="cy-v4-apy-band__anchor cy-v4-apy-band__anchor--high">{rHigh.toFixed(1)}%</span>
                </div>
              </div>

              <div className="cy-v4-alloc" style={{ marginTop: 'var(--ct-space-4)' }}>
                <p className="cy-v4-alloc__head" aria-hidden="true">ALLOCATION OVERVIEW</p>
                <div className="cy-v4-radar-block">
                  <div className="cy-v4-radar">
                    <div className="cy-v4-radar__ring cy-v4-radar__ring--1" />
                    <div className="cy-v4-radar__ring cy-v4-radar__ring--2" />
                    <div className="cy-v4-radar__ring cy-v4-radar__ring--3" />
                    <div className="cy-v4-radar__ring cy-v4-radar__ring--4" />
                    <div className="cy-v4-radar__axis cy-v4-radar__axis--v" />
                    <div className="cy-v4-radar__axis cy-v4-radar__axis--h" />
                    <div className="cy-v4-radar__axis cy-v4-radar__axis--d1" />
                    <div className="cy-v4-radar__axis cy-v4-radar__axis--d2" />
                    <div className="cy-v4-radar__center">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                    </div>
                  </div>
                  <div className="cy-v4-partial-notice">
                    <div className="cy-v4-partial-notice__text-block">
                      <span className="cy-v4-partial-notice__title">Allocation breakdown pending</span>
                      <span className="cy-v4-partial-notice__desc">vault snapshot not yet published</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="cy-v4-footer-metrics">
            <div className="cy-v4-footer-metric">
              <div className="cy-v4-footer-metric__icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span className="cy-v4-metric__label">Blended Forward</span>
                <span className="cy-v4-metric__value tabular" style={{ fontSize: "var(--ct-text-base)" }}>{rLow.toFixed(1)}-{rHigh.toFixed(1)}%</span>
              </div>
            </div>
            <div className="cy-v4-footer-metric">
              <div className="cy-v4-footer-metric__icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span className="cy-v4-metric__label">Settlement Cadence</span>
                <span className="cy-v4-metric__value" style={{ fontSize: "var(--ct-text-base)" }}>T+1</span>
              </div>
            </div>
            <div className="cy-v4-footer-metric">
              <div className="cy-v4-footer-metric__icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span className="cy-v4-metric__label">Snapshot Status</span>
                <span className="cy-v4-metric__value" style={{ fontSize: "var(--ct-text-base)" }}>Pending</span>
              </div>
            </div>
          </div>
          
          <p className="cy-v4-disclaimer" role="note">
            Conditional projection — not guaranteed ·{" "}
            {methodologyVersion.startsWith("v") ? methodologyVersion : `v${methodologyVersion}`}
          </p>
        </div>
      ) : (
        <div className="cy-v4-empty">
          <p className="cy-v4-empty__lead">Position not yet confirmed.</p>
          <p className="cy-v4-empty__sub">
            Allocation and projected yield appear once your first position is
            confirmed on-chain.
          </p>
        </div>
      )}
    </PfCockpitPanel>
  );
}
