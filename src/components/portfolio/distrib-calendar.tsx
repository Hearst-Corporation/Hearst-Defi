"use client";

/**
 * DistribCalendar — Payout Calendar widget for the investor dashboard.
 * ("Payout" is the investor-facing word for a vault distribution; the internal
 * component/prop names keep "distrib" to avoid touching data wiring.)
 *
 * 12 paid entries + 1 forecast bar = 13-bar horizontal histogram.
 * Layout: fixed 560×160 viewBox, bars left→right, labels below each bar.
 */

import { useId, useState } from "react";

import { explorerTxUrl, isPlaceholderTxHash } from "@/lib/chain/explorer";
import { resolveProvenance } from "@/lib/portfolio/provenance";
import { PortfolioLeafLink } from "@/components/portfolio/portfolio-leaf-link";
import { formatUsdFull, formatUsdDetailed } from "@/lib/vaults/product-display";

export const formatUsdc = formatUsdFull;

import {
  PfCockpitPanel,
  PfCockpitPanelHeader,
} from "@/components/portfolio/pf-cockpit-panel";

// ── Canonical reference component ─────────────────────────────────────────────
// All CSS values use --ct-* tokens. SVG geometry (viewBox coordinates, BAR_W,
// GAP, COMPACT_VB_H etc.) is the documented escape hatch — these are coordinate
// system values, not CSS spacing. See "chart-geometry escape hatch" comments below.

// ── Public types ──────────────────────────────────────────────────────────────

export interface DistribEntry {
  /** ISO month string, e.g. "2026-04" */
  period: string;
  amountUsdc: number;
  /** null = forecast */
  paidAt: Date | null;
  txHash?: string;
}

export interface DistribCalendarProps {
  /** Last 12 paid + 1 forecast */
  entries: DistribEntry[];
  /** e.g. "A" */
  shareClass: string | null;
  /** e.g. "monthly, T+5" */
  cadence: string | null;
  asOf?: Date;
  /** Provenance metadata from the loader. */
  source?: "live" | "stale";
  updatedAt?: Date;
  /** Hub-only link to the focused leaf page. */
  leafHref?: string;
  secondaryLeafHref?: string;
  secondaryLeafLabel?: string;
  embedded?: boolean;
}

// ── Formatting helpers (exported for tests) ───────────────────────────────────

/** Format period "2026-04" → "Apr'26" (first month of the series) or "Apr" (same year). */
export function formatPeriod(period: string, refYear: number): string {
  const [yearStr, monthStr] = period.split("-");
  if (!yearStr || !monthStr) return period;
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1; // 0-based
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const label = MONTHS[month] ?? "?";
  return year !== refYear ? `${label}'${String(year).slice(2)}` : label;
}

// ── SVG constants — chart-geometry escape hatch ───────────────────────────────
// These are viewBox coordinate values, not CSS spacing tokens.

const VB_W = 560;
const VB_H = 180;
const BAR_AREA_TOP = 8;
const BAR_AREA_BOT = 140;  // bottom of bars (label zone below)
const BAR_AREA_H = BAR_AREA_BOT - BAR_AREA_TOP;
const LABEL_Y = BAR_AREA_BOT + 14;
const AMOUNT_Y = BAR_AREA_BOT + 28;
const BAR_FILL = "color-mix(in srgb, var(--ct-surface-3) 92%, var(--ct-text-strong) 8%)";
const BAR_STROKE = "color-mix(in srgb, var(--ct-text-strong) 10%, transparent)";

// ── Internal helpers ──────────────────────────────────────────────────────────

/** Compute x-position of a bar's left edge (0-indexed) in the viewBox. */
export function barX(index: number, total: number, barW: number, gapW: number): number {
  const totalUsed = total * barW + (total - 1) * gapW;
  const offset = (VB_W - totalUsed) / 2;
  return offset + index * (barW + gapW);
}

/** Compute bar height, normalised to BAR_AREA_H. Returns 0 for empty series. */
export function barHeight(amount: number, maxAmount: number): number {
  if (maxAmount === 0) return 0;
  // Minimum visible height = 4px so even tiny amounts render
  return Math.max(4, (amount / maxAmount) * BAR_AREA_H);
}

/** Quarter-month indices (0-based) for compact zero-state labels: Jan, Apr, Jul, Oct. */
const COMPACT_LABEL_INDICES = [0, 3, 6, 9] as const;

export function shouldShowCompactPeriodLabel(index: number): boolean {
  return (COMPACT_LABEL_INDICES as readonly number[]).includes(index);
}

// ── SVG component ─────────────────────────────────────────────────────────────

interface BarChartProps {
  entries: DistribEntry[];
  refYear: number;
  currentPeriod: string;
  /** Zero-state skeleton: 12 muted empty bars, no amounts/labels. */
  skeleton?: boolean;
}

/** 12 flat low-height grey bars for the empty-state histogram frame. */
function SkeletonBars() {
  const n = 12;
  const GAP = 4;
  const BAR_W = Math.floor((VB_W - (n - 1) * GAP) / n);
  // Subtle uneven baseline so the frame reads as a chart, not a flat block.
  const HEIGHTS = [6, 9, 7, 11, 8, 12, 9, 13, 10, 12, 9, 11];
  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center">
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="xMidYMax meet"
        className="pf-distrib-chart pf-distrib-chart--skeleton absolute inset-0 block h-full w-full opacity-20"
        role="img"
        aria-label="Payout calendar — awaiting first distribution"
      >
        {Array.from({ length: n }, (_, i) => {
          const bh = HEIGHTS[i] ?? 8;
          const bx = barX(i, n, BAR_W, GAP);
          return (
            <rect
              key={i}
              x={bx}
              y={BAR_AREA_BOT - bh}
              width={BAR_W}
              height={bh}
              fill="var(--ct-surface-3)"
              rx="1"
              aria-hidden="true"
            />
          );
        })}
      </svg>
      <div className="z-10 flex flex-col items-center gap-1.5">
        <span className="text-[10px] uppercase tracking-[0.2em] text-secondary font-medium">No distributions yet</span>
        <span className="text-[11px] text-tertiary opacity-60">Future payouts will appear here</span>
      </div>
    </div>
  );
}

function BarChart({
  entries,
  refYear,
  currentPeriod,
  skeleton = false,
}: BarChartProps) {
  // ids uniques par instance — évite les collisions <defs>/aria-labelledby si
  // plusieurs DistribCalendar coexistent sur le document (HTML invalide sinon).
  const uid = useId();
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const n = entries.length;
  if (skeleton || n === 0) return <SkeletonBars />;

  const GAP = 4;
  const totalGaps = (n - 1) * GAP;
  const BAR_W = Math.floor((VB_W - totalGaps) / n);
  const forecastPatternId = `${uid}-forecast-hatch`;
  const titleId = `${uid}-title`;

  const maxAmount = Math.max(...entries.map((e) => e.amountUsdc), 1);

  return (
    <div className="relative w-full h-full group/chart">
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="xMidYMax meet"
        className="pf-distrib-chart block h-full w-full"
        role="img"
        aria-labelledby={titleId}
      >
        {/* Single text child (template literal) — an SVG <title> with mixed
            string + expression children serialises empty on the server and
            triggers a hydration mismatch. */}
        <title id={titleId}>{`Payout calendar — ${n} periods`}</title>

        <defs>
          {/* Diagonal hatch pattern for forecast bar */}
          <pattern
            id={forecastPatternId}
            patternUnits="userSpaceOnUse"
            width="6"
            height="6"
            patternTransform="rotate(45)"
          >
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="6"
              stroke="var(--ct-text-muted)"
              strokeWidth="2"
              style={{ strokeOpacity: "var(--ct-opacity-50)" }}
            />
          </pattern>
        </defs>

        {entries.map((entry, i) => {
          const isForecast = entry.paidAt === null;
          const isCurrent = entry.period === currentPeriod;
          const bh = barHeight(entry.amountUsdc, maxAmount);
          const bx = barX(i, n, BAR_W, GAP);
          const by = BAR_AREA_BOT - bh;
          const periodLabel = formatPeriod(entry.period, refYear);
          const amountLabel = isForecast ? "~" + formatUsdFull(entry.amountUsdc) : formatUsdFull(entry.amountUsdc);
          const cx = bx + BAR_W / 2;

          const barEl = isForecast ? (
            // Forecast: dashed-border rect + hatch fill
            <g 
              key={i} 
              role="img" 
              aria-label={`Forecast ${periodLabel} — ${amountLabel} (Estimated)`}
              className="pf-distrib-chart__bar-group"
              style={{ "--index": i } as React.CSSProperties}
            >
              {/* svg-render: dash pattern 4on/2off in viewBox units */}
              <rect
                x={bx}
                y={by}
                width={BAR_W}
                height={bh}
                fill={`url(#${forecastPatternId})`}
                stroke="var(--ct-text-muted)"
                strokeWidth="1"
                strokeDasharray="4 2"
                style={{ opacity: "var(--ct-opacity-75)" }}
                rx="1"
                className="transition-all duration-300"
              />
              {/* [Estimate] badge text above bar */}
              <text
                x={cx}
                y={by - 4}
                textAnchor="middle"
                fill="var(--ct-text-muted)"
                className="pf-distrib-chart__estimate"
                aria-hidden="true"
              >
                [Estimate]
              </text>
            </g>
          ) : entry.txHash && !isPlaceholderTxHash(entry.txHash) ? (
            // Paid with a real tx hash — wrap in anchor.
            <a
              key={i}
              href={explorerTxUrl(entry.txHash)}
              target="_blank"
              rel="noopener noreferrer"
              tabIndex={0}
              aria-label={`${periodLabel} distribution ${amountLabel} — view on BaseScan`}
              className="pf-distrib-chart__bar-group"
              style={{ "--index": i } as React.CSSProperties}
            >
              <rect
                x={bx}
                y={by}
                width={BAR_W}
                height={bh}
                fill={BAR_FILL}
                stroke={isCurrent ? "var(--ct-accent)" : BAR_STROKE}
                strokeWidth={isCurrent ? "1.5" : "0.75"}
                style={{ opacity: 1 }}
                rx="2"
                className="transition-all duration-300"
              />
            </a>
          ) : (
            // Paid, no tx hash
            <rect
              key={i}
              x={bx}
              y={by}
              width={BAR_W}
              height={bh}
              fill={BAR_FILL}
              stroke={isCurrent ? "var(--ct-accent)" : BAR_STROKE}
              strokeWidth={isCurrent ? "1.5" : "0.75"}
              rx="2"
              aria-label={`${periodLabel} distribution ${amountLabel}`}
              className="pf-distrib-chart__bar-group transition-all duration-300"
              style={{ opacity: 1, "--index": i } as React.CSSProperties}
            />
          );

          return (
            <g 
              key={i} 
              className="pf-distrib-chart__group"
              onMouseEnter={() => setHoverIndex(i)}
              onMouseLeave={() => setHoverIndex(null)}
            >
              {barEl}

              {/* Period label */}
              <text
                x={cx}
                y={LABEL_Y}
                textAnchor="middle"
                fill={isCurrent ? "var(--ct-accent)" : "var(--ct-text-muted)"}
                className="pf-distrib-chart__period"
                aria-hidden="true"
              >
                {periodLabel}
              </text>

              {/* Amount label */}
              <text
                x={cx}
                y={AMOUNT_Y}
                textAnchor="middle"
                fill="var(--ct-text-primary)"
                className="pf-distrib-chart__amount"
                aria-hidden="true"
              >
                {amountLabel}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Tooltip calibrated with ValueChart */}
      {hoverIndex !== null && entries[hoverIndex] && (() => {
        const entry = entries[hoverIndex];
        if (!entry) return null;
        return (
          <div 
            className="pf-vc-tooltip"
            style={{
              left: `${((barX(hoverIndex, n, BAR_W, GAP) + BAR_W / 2) / VB_W * 100).toFixed(3)}%`,
              top: `${((BAR_AREA_BOT - barHeight(entry.amountUsdc, maxAmount)) / VB_H * 100).toFixed(3)}%`,
              // Adjust transform to keep tooltip within bounds (match ValueChart)
              transform: `translate(${
                hoverIndex === 0 ? '0%' : 
                hoverIndex === entries.length - 1 ? '-100%' : 
                '-50%'
              }, calc(-100% - var(--ct-space-4)))`
            }}
          >
            <div className="pf-vc-tooltip__content">
              <span className="pf-vc-tooltip__value tabular-nums">
                {formatUsdDetailed(entry.amountUsdc)}
              </span>
              <div className="flex items-center justify-between gap-2 mt-1">
                <span className="pf-vc-tooltip__date">
                  {formatPeriod(entry.period, refYear)}
                </span>
                <span className="text-[9px] text-accent font-bold uppercase tracking-widest">Yield</span>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

function calendarHeaderTrail(
  leafHref?: string,
  secondaryLeafHref?: string,
  secondaryLeafLabel?: string,
) {
  if (!leafHref && !secondaryLeafHref) return undefined;
  return (
    <div className="pf-panel-leaf-trail">
      {secondaryLeafHref ? (
        <PortfolioLeafLink
          href={secondaryLeafHref}
          label={secondaryLeafLabel ?? "Tax preview"}
        />
      ) : null}
      {leafHref ? <PortfolioLeafLink href={leafHref} /> : null}
    </div>
  );
}

export function DistribCalendar({
  entries,
  shareClass,
  cadence,
  asOf,
  source = "live",
  updatedAt,
  leafHref,
  secondaryLeafHref,
  secondaryLeafLabel,
  embedded = false,
}: DistribCalendarProps) {
  // id unique par instance — évite la collision de gradient <defs> si plusieurs
  // calendriers en zero-state coexistent (duplicate id = HTML invalide).
  const now = asOf ?? new Date();
  const refYear = now.getUTCFullYear();

  const currentPeriod = `${refYear}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

  const hasEntries = entries.length > 0;
  const hasForecast = entries.some((e) => e.paidAt === null);

  // Zero-state: render the histogram SKELETON (empty muted bars), no phrase.
  // The frame fills in with real bars as soon as the first distribution lands.
  if (!hasEntries) {
    return (
      <PfCockpitPanel
        variant="wide"
        chrome={embedded ? "embedded" : "panel"}
        aria-label="Payout calendar — awaiting first distribution"
        className="pf-payout-calendar-panel pf-payout-calendar-panel--zero h-full"
      >
        <PfCockpitPanelHeader
          title="Payout Calendar"
          subtitle="Monthly USDC distributions"
          titleVariant="primary"
          trailing={calendarHeaderTrail(leafHref)}
        />
        <div className="pf-distrib-chart-shell">
          <BarChart entries={[]} refYear={refYear} currentPeriod={currentPeriod} skeleton />
        </div>
      </PfCockpitPanel>
    );
  }

  // CRITICAL provenance rule — preserved verbatim:
  // In live mode with hasEntries: source==="live" → "attested"; otherwise resolveProvenance fallback.
  const liveProvenance =
    source === "live"
      ? ("attested" as const)
      : resolveProvenance(source, updatedAt, "estimated");

  const header = (
    <PfCockpitPanelHeader
      title="Payout Calendar"
      subtitle={`12m · USDC${hasForecast ? " · forecast" : ""}`}
      provenance={liveProvenance}
      trailing={calendarHeaderTrail(leafHref, secondaryLeafHref, secondaryLeafLabel)}
    />
  );

  // Footer — share class + cadence.
  const calendarFooter = (shareClass || cadence) ? (
    <dl className="pf-calendar-footer">
      {shareClass ? (
        <div className="pf-calendar-footer__item">
          <dt className="stat-label mono">Share class</dt>
          <dd className="body-sm ct-text-body mono tabular">
            Series {shareClass}
          </dd>
        </div>
      ) : null}
      {cadence ? (
        <div className="pf-calendar-footer__item">
          <dt className="stat-label mono">Cadence</dt>
          <dd className="body-sm ct-text-body mono tabular">{cadence}</dd>
        </div>
      ) : null}
    </dl>
  ) : null;

  return (
    <PfCockpitPanel
      variant="wide"
      chrome={embedded ? "embedded" : "panel"}
      aria-label="Payout calendar"
      className="pf-payout-calendar-panel h-full"
    >
      {header}
      <div className="pf-distrib-chart-shell">
        <BarChart
          entries={entries}
          refYear={refYear}
          currentPeriod={currentPeriod}
        />
      </div>
      {calendarFooter}
    </PfCockpitPanel>
  );
}
