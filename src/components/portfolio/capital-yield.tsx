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
 * Capital & Yield — Premium V5 instrument panel.
 *
 * Two-tier layout:
 *   · headline metrics    — Capital active · Target APY + inline range band
 *   · lower visual zone   — allocation donut + structured legend
 *   · horizon chip        — discreet 12m fwd meta in panel header
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
 * Monochrome-green bucket palette — single accent, graded by mixing toward a
 * neutral. No raw hex/rgb in TSX (derivations via color-mix tokens).
 */
const BUCKET_COLOR: Record<YieldSource["bucket"], string> = {
  mining: "var(--ct-accent)",
  usdc_base: "color-mix(in srgb, var(--ct-accent) 68%, var(--ct-text-neutral))",
  btc_tactical: "color-mix(in srgb, var(--ct-accent) 46%, var(--ct-text-neutral))",
  stable_reserve: "color-mix(in srgb, var(--ct-accent) 28%, var(--ct-text-neutral))",
};

/* ── Donut geometry — canonical convention (radius − stroke/2, rotate −90) ── */
const DONUT_RADIUS = 42;
const DONUT_STROKE = 11;
const DONUT_NORM_R = DONUT_RADIUS - DONUT_STROKE / 2;
const DONUT_CIRC = DONUT_NORM_R * 2 * Math.PI;

type DonutSegment = {
  bucket: AllocationBucketSlice["bucket"];
  pct: number;
  color: string;
  dash: string;
  rotation: number;
};

function buildDonutSegments(buckets: AllocationBucketSlice[]): DonutSegment[] {
  const total = buckets.reduce((sum, b) => sum + b.pct, 0) || 100;
  return buckets.reduce<DonutSegment[]>((acc, b) => {
    const preceding = acc.reduce((sum, p) => sum + p.pct, 0);
    const frac = b.pct / total;
    acc.push({
      bucket: b.bucket,
      pct: b.pct,
      color: BUCKET_COLOR[b.bucket],
      dash: `${frac * DONUT_CIRC} ${DONUT_CIRC}`,
      rotation: (preceding / total) * 360,
    });
    return acc;
  }, []);
}

/* ── Allocation donut (live data) ──────────────────────────────────────────── */
function AllocationDonut({
  buckets,
  centerTop,
  centerMain,
}: {
  buckets: AllocationBucketSlice[];
  centerTop: string;
  centerMain: string;
}) {
  const segments = buildDonutSegments(buckets);
  return (
    <div className="cy-v5-donut" role="img" aria-label="Allocation by bucket">
      <svg
        viewBox={`0 0 ${DONUT_RADIUS * 2} ${DONUT_RADIUS * 2}`}
        className="cy-v5-donut__svg"
      >
        <circle
          cx={DONUT_RADIUS}
          cy={DONUT_RADIUS}
          r={DONUT_NORM_R}
          fill="transparent"
          stroke="var(--ct-surface-1)"
          strokeWidth={DONUT_STROKE}
          className="cy-v5-donut__track"
        />
        {segments.map((s) => (
          <circle
            key={s.bucket}
            cx={DONUT_RADIUS}
            cy={DONUT_RADIUS}
            r={DONUT_NORM_R}
            fill="transparent"
            stroke={s.color}
            strokeWidth={DONUT_STROKE}
            strokeDasharray={s.dash}
            strokeDashoffset={0}
            strokeLinecap="butt"
            transform={`rotate(${s.rotation - 90} ${DONUT_RADIUS} ${DONUT_RADIUS})`}
            className="cy-v5-donut__seg"
          />
        ))}
      </svg>
      <div className="cy-v5-donut__center">
        <span className="cy-v5-donut__center-top">{centerTop}</span>
        <span className="cy-v5-donut__center-main tabular">{centerMain}</span>
      </div>
    </div>
  );
}

/* ── Pending donut (no vault snapshot) — honest, no invented split ─────────── */
function PendingDonut() {
  return (
    <div className="cy-v5-donut cy-v5-donut--pending" aria-hidden="true">
      <svg
        viewBox={`0 0 ${DONUT_RADIUS * 2} ${DONUT_RADIUS * 2}`}
        className="cy-v5-donut__svg"
      >
        {/* full thin ring — neutral, no invented split */}
        <circle
          cx={DONUT_RADIUS}
          cy={DONUT_RADIUS}
          r={DONUT_NORM_R}
          fill="transparent"
          stroke="var(--ct-surface-1)"
          strokeWidth={DONUT_STROKE}
          className="cy-v5-donut__track"
        />
        {/* dashed accent overlay — signals "awaiting", static, elegant */}
        <circle
          cx={DONUT_RADIUS}
          cy={DONUT_RADIUS}
          r={DONUT_NORM_R}
          fill="transparent"
          stroke="color-mix(in srgb, var(--ct-accent) 38%, transparent)"
          strokeWidth={1.5}
          strokeDasharray="2 5"
          strokeLinecap="round"
          className="cy-v5-donut__pending-ring"
        />
      </svg>
      <div className="cy-v5-donut__center">
        <span className="cy-v5-donut__center-top">Awaiting</span>
        <span className="cy-v5-donut__center-sub">snapshot</span>
      </div>
    </div>
  );
}

/* ── Compact APY range track — visual band only (values live in Target APY) ── */
function ApyRangeTrack({ low, high }: { low: number; high: number }) {
  return (
    <div
      className="cy-v5-apy cy-v5-apy--inline"
      aria-hidden="true"
      title={`Target APY range ${low.toFixed(1)}–${high.toFixed(1)}%`}
    >
      <div className="cy-v5-apy__track">
        <span className="cy-v5-apy__band" />
        <span className="cy-v5-apy__tick cy-v5-apy__tick--low" />
        <span className="cy-v5-apy__tick cy-v5-apy__tick--high" />
      </div>
      <div className="cy-v5-apy__anchors">
        <span className="cy-v5-apy__anchor tabular">{low.toFixed(1)}%</span>
        <span className="cy-v5-apy__anchor cy-v5-apy__anchor--high tabular">
          {high.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}

/* ── Editorial headline metrics — Capital + Target APY (range nested under APY) ─ */
function MetricsHeadline({
  totalValueUsdc,
  rLow,
  rHigh,
}: {
  totalValueUsdc: number;
  rLow: number;
  rHigh: number;
}) {
  return (
    <div className="cy-v5-headline">
      <div className="cy-v5-metric cy-v5-metric--primary">
        <span className="cy-v5-metric__label">Capital active</span>
        <span className="cy-v5-metric__value tabular">
          {formatUsdCompact(totalValueUsdc)}
        </span>
      </div>
      <div className="cy-v5-metric cy-v5-metric--accent">
        <span className="cy-v5-metric__label">Target APY</span>
        <div className="cy-v5-metric__apy-row">
          <span className="cy-v5-metric__value">
            <ApyRange
              low={rLow}
              high={rHigh}
              className="font-bold ct-text-accent tabular"
            />
          </span>
          <ApyRangeTrack low={rLow} high={rHigh} />
        </div>
      </div>
    </div>
  );
}

function HorizonChip() {
  return <span className="cy-v5-horizon-chip tabular">12m fwd</span>;
}

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
  // LIVE: we have vault allocation + real data + investor position
  const hasData =
    sources.length > 0 && totalValueUsdc > 0 && buckets.length > 0;

  // Two distinct empty states — never same copy (historical incoherence):
  //   awaiting-data: position confirmed on-chain, vault snapshot not yet cached
  //   no-position:   investor has not subscribed yet
  const emptyReason: "no-position" | "awaiting-data" =
    hasActivePosition && totalValueUsdc > 0 ? "awaiting-data" : "no-position";

  // Rich partial: a confirmed position with real capital, but the vault
  // allocation breakdown is not yet published. We still surface the REAL figures
  // the account already has (capital + target APY) instead of an empty block.
  const showRichPartial =
    !hasData && emptyReason === "awaiting-data" && totalValueUsdc > 0;

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
        subtitle={
          hasData
            ? "Active capital · 12m forward yield"
            : showRichPartial
              ? "Active capital · allocation pending"
              : undefined
        }
        provenance={provenance}
        titleVariant="primary"
        trailing={
          hasData || showRichPartial ? (
            <div className="cy-v5-header-trail">
              <HorizonChip />
              {leafHref ? <PortfolioLeafLink href={leafHref} /> : null}
            </div>
          ) : leafHref ? (
            <PortfolioLeafLink href={leafHref} />
          ) : undefined
        }
      />

      {hasData ? (
        <div className="cy-v5-body">
          <MetricsHeadline
            totalValueUsdc={totalValueUsdc}
            rLow={rLow}
            rHigh={rHigh}
          />

          {/* ── Tier 2 — allocation donut + legend ── */}
          <div className="cy-v5-visual">
            <AllocationDonut
              buckets={buckets}
              centerTop="Alloc"
              centerMain={`${buckets.reduce((sum, bucket) => sum + bucket.pct, 0)}%`}
            />

            <ul className="cy-v5-legend" aria-label="Allocation breakdown">
              {buckets.map((b) => {
                const src = sources.find((s) => s.bucket === b.bucket);
                const contribution = src?.contributionPct ?? null;
                const contribLabel =
                  contribution !== null
                    ? src?.isVolatile
                      ? `±${Math.abs(contribution).toFixed(1)}%`
                      : contribution < 0
                        ? `−${Math.abs(contribution).toFixed(1)}%`
                        : `+${contribution.toFixed(1)}%`
                    : null;

                return (
                  <li key={b.bucket} className="cy-v5-legend__row">
                    <span
                      className="cy-v5-legend__dot"
                      style={{ background: BUCKET_COLOR[b.bucket] }}
                      aria-hidden="true"
                    />
                    <span className="cy-v5-legend__label">
                      {src?.label ?? b.bucket}
                    </span>
                    <span className="cy-v5-legend__pct tabular">{b.pct}%</span>
                    {contribLabel !== null ? (
                      <span
                        className={cn(
                          "cy-v5-legend__contrib tabular",
                          src?.isVolatile && "cy-v5-legend__contrib--volatile",
                        )}
                      >
                        {contribLabel}
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>

          {/* ── Disclaimer — non-negotiable #10 ── */}
          <p className="cy-v5-disclaimer" role="note">
            Conditional projection — not guaranteed ·{" "}
            {methodologyVersion.startsWith("v")
              ? methodologyVersion
              : `v${methodologyVersion}`}
          </p>
        </div>
      ) : showRichPartial ? (
        <div className="cy-v5-body">
          <MetricsHeadline
            totalValueUsdc={totalValueUsdc}
            rLow={rLow}
            rHigh={rHigh}
          />

          {/* ── Tier 2 — honest pending allocation ── */}
          <div className="cy-v5-visual cy-v5-visual--pending">
            <PendingDonut />
            <div className="cy-v5-pending-copy">
              <span className="cy-v5-pending-copy__title">
                Allocation breakdown pending
              </span>
              <span className="cy-v5-pending-copy__desc">
                vault snapshot not yet published — your capital and target yield
                are confirmed; the bucket split appears on the next snapshot.
              </span>
            </div>
          </div>

          <p className="cy-v5-disclaimer" role="note">
            Conditional projection — not guaranteed ·{" "}
            {methodologyVersion.startsWith("v")
              ? methodologyVersion
              : `v${methodologyVersion}`}
          </p>
        </div>
      ) : (
        <div className="cy-v5-empty">
          <p className="cy-v5-empty__lead">Position not yet confirmed.</p>
          <p className="cy-v5-empty__sub">
            Allocation and projected yield appear once your first position is
            confirmed on-chain.
          </p>
        </div>
      )}
    </PfCockpitPanel>
  );
}
