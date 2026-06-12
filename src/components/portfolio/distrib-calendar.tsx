/**
 * DistribCalendar — Payout Calendar widget for the investor dashboard.
 * ("Payout" is the investor-facing word for a vault distribution; the internal
 * component/prop names keep "distrib" to avoid touching data wiring.)
 *
 * 12 paid entries + 1 forecast bar = 13-bar horizontal histogram.
 * Pure Server Component — no client JS. CSS :focus-within for accessible
 * hover reveals via sibling selector in `group`.
 *
 * Layout: fixed 560×160 viewBox, bars left→right, labels below each bar.
 */

import {
  PfCockpitPanel,
  PfCockpitPanelHeader,
} from "@/components/portfolio/pf-cockpit-panel";
import { explorerTxUrl } from "@/lib/chain/client";
import { resolveProvenance } from "@/lib/portfolio/provenance";
import { formatUsdcAmount } from "@/lib/vaults/product-display";

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
  /** Layout preview at zero — nested empty chart only (DS §9.3). */
  previewZeros?: boolean;
  /** Inside MergedSurface — parent supplies section label; no nested dash-cell. */
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

/** @deprecated Import formatUsdcAmount from @/lib/vaults/product-display */
export const formatUsdc = formatUsdcAmount;

// ── SVG constants ─────────────────────────────────────────────────────────────

const VB_W = 560;
const VB_H = 180;
const BAR_AREA_TOP = 8;
const BAR_AREA_BOT = 140;  // bottom of bars (label zone below)
const BAR_AREA_H = BAR_AREA_BOT - BAR_AREA_TOP;
const LABEL_Y = BAR_AREA_BOT + 14;
const AMOUNT_Y = BAR_AREA_BOT + 28;

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
export const COMPACT_LABEL_INDICES = [0, 3, 6, 9] as const;

export function shouldShowCompactPeriodLabel(index: number): boolean {
  return (COMPACT_LABEL_INDICES as readonly number[]).includes(index);
}

/** Compact zero-state canvas — cropped to axis + quarter labels only (not VB_H). */
const COMPACT_VB_H = 64;
const COMPACT_AXIS_Y = 36;
const COMPACT_LABEL_Y = 54;

// ── SVG component ─────────────────────────────────────────────────────────────

interface BarChartProps {
  entries: DistribEntry[];
  refYear: number;
  currentPeriod: string;
  /** Calm 12-month rail for layout-preview / zero-state — no per-bar amounts or [Estimate]. */
  compactPreview?: boolean;
}

function BarChart({
  entries,
  refYear,
  currentPeriod,
  compactPreview = false,
}: BarChartProps) {
  const n = entries.length;
  if (n === 0) return null;

  // Bar geometry
  const GAP = 4;
  const totalGaps = (n - 1) * GAP;
  // Cap bar width to avoid "shaft" look when there are few entries or wide container
  const BAR_W = Math.min(Math.floor((VB_W - totalGaps) / n), 40);
  // Unique IDs for SVG defs (static — RSC renders once per request)
  const forecastPatternId = "dc-forecast-hatch";
  const titleId = "dc-title";

  // max-h-[180px] below: render constraint, not a spacing token — caps the SVG
  // canvas height so the chart can't grow taller than its cell. Intentional
  // arbitrary value (chart dimension, off the --ct-space-* scale).

  if (compactPreview) {
    const compactTitle =
      "Payout calendar — 12-month USDC forecast, no payout history yet, current period marked";
    const firstBx = barX(0, n, BAR_W, GAP);
    const lastBx = barX(n - 1, n, BAR_W, GAP);
    const axisEnd = lastBx + BAR_W;

    return (
      <svg
        viewBox={`0 0 ${VB_W} ${COMPACT_VB_H}`}
        preserveAspectRatio="xMidYMin meet"
        className="pf-distrib-chart pf-distrib-chart--compact block w-full max-h-16"
        role="img"
        aria-label={compactTitle}
      >
        <title id={titleId}>{compactTitle}</title>

        <line
          x1={firstBx}
          y1={COMPACT_AXIS_Y}
          x2={axisEnd}
          y2={COMPACT_AXIS_Y}
          stroke="var(--ct-border-soft)"
          strokeWidth="1"
          aria-hidden="true"
        />

        {entries.map((entry, i) => {
          const bx = barX(i, n, BAR_W, GAP);
          const cx = bx + BAR_W / 2;
          const isCurrent = entry.period === currentPeriod;
          const isQuarter = shouldShowCompactPeriodLabel(i);
          const periodLabel = formatPeriod(entry.period, refYear);

          // Fixed width for zero-state bars to avoid "shaft" look when stretched
          const COMPACT_BAR_W = 12;
          const cbx = cx - COMPACT_BAR_W / 2;

          return (
            <g key={i} aria-hidden="true">
              <rect
                x={cbx}
                y={COMPACT_AXIS_Y - 4}
                width={COMPACT_BAR_W}
                height={4}
                rx={1}
                fill={isCurrent ? "var(--ct-accent)" : "var(--ct-border-soft)"}
                fillOpacity={isCurrent ? 0.8 : 0.4}
              />
              {isQuarter ? (
                <text
                  x={cx}
                  y={COMPACT_LABEL_Y}
                  textAnchor="middle"
                  fill="var(--ct-text-muted)"
                  className="pf-distrib-chart__period"
                >
                  {periodLabel}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    );
  }

  const maxAmount = Math.max(...entries.map((e) => e.amountUsdc), 1);

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      preserveAspectRatio="xMidYMid meet"
      className="pf-distrib-chart w-full max-h-28"
      role="img"
      aria-labelledby={titleId}
    >
      {/* Single text child (template literal) — an SVG <title> with mixed
          string + expression children serialises empty on the server and
          triggers a hydration mismatch (cf. vc-title which is a single child). */}
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
            stroke="var(--ct-status-warning)"
            strokeWidth="2"
            strokeOpacity="0.5"
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
        const amountLabel = isForecast ? "~" + formatUsdc(entry.amountUsdc) : formatUsdc(entry.amountUsdc);
        const cx = bx + BAR_W / 2;

        const barEl = isForecast ? (
          // Forecast: dashed-border rect + hatch fill
          <g key={i} role="img" aria-label={`Forecast ${periodLabel} — ${amountLabel} (Estimated)`}>
            <rect
              x={bx}
              y={by}
              width={BAR_W}
              height={bh}
              fill={`url(#${forecastPatternId})`}
              stroke="var(--ct-status-warning)"
              strokeWidth="1"
              strokeDasharray="4 2"
              opacity="0.7"
              rx="1"
            />
            {/* [Estimate] badge text above bar */}
            <text
              x={cx}
              y={by - 4}
              textAnchor="middle"
              fill="var(--ct-status-warning)"
              className="pf-distrib-chart__estimate"
              aria-hidden="true"
            >
              [Estimate]
            </text>
          </g>
        ) : entry.txHash ? (
          // Paid with tx hash — wrap in anchor
          <a
            key={i}
            href={explorerTxUrl(entry.txHash)}
            target="_blank"
            rel="noopener noreferrer"
            tabIndex={0}
            aria-label={`${periodLabel} distribution ${amountLabel} — view on BaseScan`}
          >
            <rect
              x={bx}
              y={by}
              width={BAR_W}
              height={bh}
              fill="var(--ct-accent)"
              opacity="0.6"
              rx="1"
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
            fill="var(--ct-accent)"
            opacity="0.6"
            rx="1"
            aria-label={`${periodLabel} distribution ${amountLabel}`}
          />
        );

        return (
          <g key={i}>
            {barEl}

            {/* Current month ◀ indicator */}
            {isCurrent && (
              <text
                x={cx + BAR_W / 2 + 2}
                y={by + bh / 2 + 2}
                fill="var(--ct-accent)"
                className="pf-distrib-chart__marker ct-donut-slice-glow"
                aria-hidden="true"
              >
                ◀
              </text>
            )}

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
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function DistribCalendar({
  entries,
  shareClass,
  cadence,
  asOf,
  source = "live",
  updatedAt,
  previewZeros = false,
}: DistribCalendarProps) {
  const now = asOf ?? new Date();
  const refYear = now.getUTCFullYear();

  // Derive current month period string "YYYY-MM"
  const currentPeriod = `${refYear}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

  const displayEntries = entries;
  const hasEntries = displayEntries.length > 0;
  const hasForecast = displayEntries.some((e) => e.paidAt === null);

  const showZeroShell = previewZeros || !hasEntries;
  const badgeKind = showZeroShell
    ? undefined
    : hasEntries && source === "live"
      ? "attested"
      : resolveProvenance(source, updatedAt, "estimated");

  return (
    <PfCockpitPanel variant="compact" aria-label="Payout calendar">
      <PfCockpitPanelHeader
        title="Payout calendar"
        subtitle={
          previewZeros
            ? "12m forecast · USDC"
            : `12m · USDC${hasForecast ? " · forecast" : ""}`
        }
        provenance={badgeKind}
      />

      <div className="w-full overflow-hidden rounded-md">
        <BarChart
          entries={displayEntries}
          refYear={refYear}
          currentPeriod={currentPeriod}
          compactPreview={previewZeros}
        />
      </div>

      {previewZeros ? (
        <div className="pt-1" role="note">
          <p className="body-xs ct-text-muted m-0">
            No payout history yet · $0 forecast
          </p>
          <p className="body-xs ct-text-faint m-0 mt-0.5">
            Current period marked
          </p>
        </div>
      ) : null}

      {/* Footer — share class + cadence. Rendered only when at least one is
          known, so an empty widget doesn't show a "— / —" stub. */}
      {(shareClass || cadence) && (
        <dl className="flex flex-wrap gap-x-4 gap-y-1 border-t border-(--ct-border-soft) pt-2 mt-auto">
          {shareClass ? (
            <div className="pf-stack--compact min-w-0">
              <dt className="stat-label mono">
                Share class
              </dt>
              <dd className="body-sm ct-text-body mono tabular">
                Series {shareClass}
              </dd>
            </div>
          ) : null}
          {cadence ? (
            <div className="pf-stack--compact min-w-0">
              <dt className="stat-label mono">
                Cadence
              </dt>
              <dd className="body-sm ct-text-body mono tabular">
                {cadence}
              </dd>
            </div>
          ) : null}
        </dl>
      )}
    </PfCockpitPanel>
  );
}
