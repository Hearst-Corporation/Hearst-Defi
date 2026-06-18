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

import { cn } from "@/lib/cn";
import { explorerTxUrl, isPlaceholderTxHash } from "@/lib/chain/client";
import { resolveProvenance } from "@/lib/portfolio/provenance";
import { resolveWidgetView } from "@/lib/portfolio/view-state";
import { PortfolioLeafLink } from "@/components/portfolio/portfolio-leaf-link";
import { formatUsdFull } from "@/lib/vaults/product-display";
import { WidgetShell } from "@/components/portfolio/widget-shell";
import {
  PanelStatus,
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
  /** Layout preview at zero — nested empty chart only (DS §9.3). */
  previewZeros?: boolean;
  /** Hub-only link to the focused leaf page. */
  leafHref?: string;
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

/** @deprecated Import formatUsdFull from @/lib/vaults/product-display */
export const formatUsdc = formatUsdFull;

// ── SVG constants — chart-geometry escape hatch ───────────────────────────────
// These are viewBox coordinate values, not CSS spacing tokens.
// VB_W/VB_H define the SVG coordinate system; BAR_AREA_* are layout zones
// within that coordinate system. None of these map to --ct-space-* tokens.

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
const COMPACT_LABEL_INDICES = [0, 3, 6, 9] as const;

export function shouldShowCompactPeriodLabel(index: number): boolean {
  return (COMPACT_LABEL_INDICES as readonly number[]).includes(index);
}

// Compact zero-state canvas — cropped coordinate system for the preview rail.
// These pixel values are SVG viewBox units, not CSS px.
/** Compact zero-state canvas — cropped to axis + quarter labels only (not VB_H). */
const COMPACT_VB_H = 64;
const COMPACT_AXIS_Y = 40;
const COMPACT_LABEL_Y = 54;
const COMPACT_BAR_H = 14;

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

  // Bar geometry — SVG viewBox units. GAP=4 = 4 viewBox units between bars.
  // Full viewBox width (no cap) so bars scale with the panel.
  const GAP = 4;
  const totalGaps = (n - 1) * GAP;
  const BAR_W = Math.floor((VB_W - totalGaps) / n);
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
        preserveAspectRatio="xMidYMax meet"
        className="pf-distrib-chart pf-distrib-chart--compact block h-full w-full"
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

          // Full-width zero-state bars (same geometry as populated chart).
          const cbx = bx;
          const barWidth = BAR_W;

          return (
            <g key={i} aria-hidden="true">
              <rect
                x={cbx}
                y={COMPACT_AXIS_Y - COMPACT_BAR_H}
                width={barWidth}
                height={COMPACT_BAR_H}
                rx={1}
                fill={isCurrent ? "var(--ct-accent)" : "var(--ct-border-soft)"}
                style={{ fillOpacity: isCurrent ? "var(--ct-opacity-80)" : "var(--ct-opacity-40)" }}
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
      preserveAspectRatio="xMidYMax meet"
      className="pf-distrib-chart block h-full w-full"
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
        const amountLabel = isForecast ? "~" + formatUsdc(entry.amountUsdc) : formatUsdc(entry.amountUsdc);
        const cx = bx + BAR_W / 2;

        const barEl = isForecast ? (
          // Forecast: dashed-border rect + hatch fill
          <g key={i} role="img" aria-label={`Forecast ${periodLabel} — ${amountLabel} (Estimated)`}>
            {/* svg-render: dash pattern 4on/2off in viewBox units */}
            <rect
              x={bx}
              y={by}
              width={BAR_W}
              height={bh}
              fill={`url(#${forecastPatternId})`}
              stroke="var(--ct-status-warning)"
              strokeWidth="1"
              strokeDasharray="4 2"
              style={{ opacity: "var(--ct-opacity-70)" }}
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
        ) : entry.txHash && !isPlaceholderTxHash(entry.txHash) ? (
          // Paid with a real tx hash — wrap in anchor. Fabricated seed/demo
          // hashes fall through to the no-link "paid" bar below (dead BaseScan).
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
              style={{ opacity: "var(--ct-opacity-60)" }}
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
            style={{ opacity: "var(--ct-opacity-60)" }}
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
  leafHref,
}: DistribCalendarProps) {
  if (previewZeros) {
    return (
      <PfCockpitPanel
        variant="compact"
        aria-label="Payout calendar — awaiting first position"
        className="pf-payout-calendar-panel pf-payout-calendar-panel--onboarding"
        data-testid="distrib-calendar-widget"
      >
        <PfCockpitPanelHeader
          title="Payout calendar"
          subtitle="Monthly USDC distributions"
          titleVariant="primary"
        />
        <p className="body-sm ct-text-muted m-0" role="status">
          Payout schedule appears after your first confirmed position.
        </p>
      </PfCockpitPanel>
    );
  }

  const now = asOf ?? new Date();
  const refYear = now.getUTCFullYear();

  // Derive current month period string "YYYY-MM"
  const currentPeriod = `${refYear}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

  const hasEntries = entries.length > 0;
  const hasForecast = entries.some((e) => e.paidAt === null);

  // CRITICAL provenance rule — preserved verbatim from original:
  // In zero mode (previewZeros || !hasEntries), provenance is undefined (no badge).
  // In live mode with hasEntries: source==="live" → "attested"; otherwise resolveProvenance fallback.
  // resolveWidgetView nulls provenance in zero mode (honesty contract, CLAUDE.md §2).
  const liveProvenance =
    hasEntries && source === "live"
      ? "attested"
      : resolveProvenance(source, updatedAt, "estimated");
  const view = resolveWidgetView({
    previewZeros,
    hasData: hasEntries,
    provenance: liveProvenance,
  });

  // Footer — share class + cadence. Rendered only when at least one is
  // known, so an empty widget doesn't show a "— / —" stub.
  // Rendered in BOTH zero and live modes (not gated on data state).
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

  // zeroSlot: compact bar chart + footer
  const zeroSlot = (
    <>
      <div className="pf-distrib-chart-shell">
        <BarChart
          entries={entries}
          refYear={refYear}
          currentPeriod={currentPeriod}
          compactPreview
        />
      </div>
      {previewZeros ? (
        <PanelStatus
          role="note"
          message="No payout history yet · $0 forecast"
          detail="Current period marked"
        />
      ) : null}
      {calendarFooter}
    </>
  );

  // liveContent: full bar chart + footer
  const liveContent = (
    <>
      <div className="pf-distrib-chart-shell">
        <BarChart
          entries={entries}
          refYear={refYear}
          currentPeriod={currentPeriod}
        />
      </div>
      {calendarFooter}
    </>
  );

  return (
    <WidgetShell
      variant="wide"
      ariaLabel="Payout calendar"
      title="Payout calendar"
      subtitle={
        previewZeros
          ? "12m forecast"
          : `12m · USDC${hasForecast ? " · forecast" : ""}`
      }
      view={view}
      trailing={leafHref ? <PortfolioLeafLink href={leafHref} /> : undefined}
      zeroSlot={zeroSlot}
      className={cn(
        "pf-payout-calendar-panel",
        view.mode === "zero" && "pf-payout-calendar-panel--zero",
      )}
    >
      {liveContent}
    </WidgetShell>
  );
}
