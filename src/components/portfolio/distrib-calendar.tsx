"use client";

/**
 * DistribCalendar — Payout Calendar widget for the investor dashboard.
 * ("Payout" is the investor-facing word for a vault distribution; the internal
 * component/prop names keep "distrib" to avoid touching data wiring.)
 *
 * 12 paid entries + 1 forecast bar = 13-bar horizontal histogram.
 * Layout: fixed 560×160 viewBox, bars left→right, labels below each bar.
 */

import { useId } from "react";

import { explorerTxUrl, isPlaceholderTxHash } from "@/lib/chain/explorer";
import { resolveProvenance } from "@/lib/portfolio/provenance";
import { PortfolioLeafLink } from "@/components/portfolio/portfolio-leaf-link";
import { formatUsdFull } from "@/lib/vaults/product-display";

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
  /** Next expected distribution date (estimated from schedule). Used in zero-state only. */
  nextDistributionAt?: Date;
  /** Whether the investor has an active position — used to decide zero-state copy. */
  hasActivePosition?: boolean;
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
const VB_H = 168;
const BAR_AREA_TOP = 20;
const BAR_AREA_BOT = 138;  // bottom of bars (label zone below)
const BAR_AREA_H = BAR_AREA_BOT - BAR_AREA_TOP;
const LABEL_Y = BAR_AREA_BOT + 13;
const AMOUNT_Y = BAR_AREA_BOT + 26;

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

const MONTHS_ON_AXIS = 12;

/**
 * Always render a fixed 12-month axis ending at the current month, so the bars
 * stay a consistent (narrow) width whether the investor has 1 payout or 12 —
 * never a few giant bars stretched across the panel. Months without a payout
 * become empty slots (amount 0): label only, no bar. Real entries (and the
 * forecast) are placed in their month; anything outside the window is dropped.
 */
export function buildTwelveMonthAxis(
  entries: DistribEntry[],
  now: Date,
): DistribEntry[] {
  const byPeriod = new Map(entries.map((e) => [e.period, e]));
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const axis: DistribEntry[] = [];
  for (let i = MONTHS_ON_AXIS - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - i, 1));
    const period = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    axis.push(
      byPeriod.get(period) ?? { period, amountUsdc: 0, paidAt: d },
    );
  }
  return axis;
}

// ── SVG component ─────────────────────────────────────────────────────────────

interface BarChartProps {
  entries: DistribEntry[];
  refYear: number;
  currentPeriod: string;
}

function BarChart({
  entries,
  refYear,
  currentPeriod,
}: BarChartProps) {
  // ids uniques par instance — évite les collisions <defs>/aria-labelledby si
  // plusieurs DistribCalendar coexistent sur le document (HTML invalide sinon).
  const uid = useId();
  const n = entries.length;
  if (n === 0) return null;

  const GAP = 4;
  const totalGaps = (n - 1) * GAP;
  const BAR_W = Math.floor((VB_W - totalGaps) / n);
  const forecastPatternId = `${uid}-forecast-hatch`;
  const barGradId = `${uid}-bar-grad`;
  const titleId = `${uid}-title`;

  const maxAmount = Math.max(...entries.map((e) => e.amountUsdc), 1);

  return (
    <div className="relative w-full h-full">
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="xMidYMid meet"
        className="pf-distrib-chart block h-full w-full"
        role="img"
        aria-labelledby={titleId}
      >
        {/* Single text child (template literal) — an SVG <title> with mixed
            string + expression children serialises empty on the server and
            triggers a hydration mismatch. */}
        <title id={titleId}>{`Payout calendar — ${n} periods`}</title>

        <defs>
          {/* Accent-green bar fill — bright top edge fading down into the panel. */}
          <linearGradient id={barGradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--ct-accent)" stopOpacity="0.7" />
            <stop offset="55%" stopColor="var(--ct-accent)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="var(--ct-accent)" stopOpacity="0.07" />
          </linearGradient>
          {/* Diagonal hatch pattern for forecast bar — accent-tinted */}
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
              stroke="var(--ct-accent)"
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

          // Empty month slot (no payout that month) — render just the month
          // label so the 12-month axis stays consistent without a giant bar.
          if (!isForecast && entry.amountUsdc <= 0) {
            return (
              <g key={i} className="pf-distrib-chart__group">
                <text
                  x={cx}
                  y={LABEL_Y}
                  textAnchor="middle"
                  fill="var(--ct-text-muted)"
                  className="pf-distrib-chart__period pf-distrib-chart__period--empty"
                  aria-hidden="true"
                >
                  {periodLabel}
                </text>
              </g>
            );
          }

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
                fill={`url(#${barGradId})`}
                stroke="var(--ct-accent)"
                strokeWidth={isCurrent ? "1.5" : "1"}
                style={{ opacity: isCurrent ? 1 : 0.92 }}
                rx="2"
                className="pf-distrib-bar"
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
              fill={`url(#${barGradId})`}
              stroke="var(--ct-accent)"
              strokeWidth={isCurrent ? "1.5" : "1"}
              rx="2"
              aria-label={`${periodLabel} distribution ${amountLabel}`}
              className="pf-distrib-chart__bar-group pf-distrib-bar"
              style={{ opacity: isCurrent ? 1 : 0.92, "--index": i } as React.CSSProperties}
            />
          );

          return (
            <g 
              key={i} 
              className="pf-distrib-chart__group"
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

const distribDateFmt = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

const distribMonthFmt = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

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
  nextDistributionAt,
  hasActivePosition = false,
}: DistribCalendarProps) {
  // id unique par instance — évite la collision de gradient <defs> si plusieurs
  // calendriers en zero-state coexistent (duplicate id = HTML invalide).
  const now = asOf ?? new Date();
  const refYear = now.getUTCFullYear();

  const currentPeriod = `${refYear}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

  const hasEntries = entries.length > 0;
  const hasForecast = entries.some((e) => e.paidAt === null);

  // Zero-state: show "Distribution coming" box if position active,
  // or plain skeleton if no position yet.
  if (!hasEntries) {
    const showComingBox = hasActivePosition && nextDistributionAt != null;
    const nextDate = nextDistributionAt;

    return (
      <PfCockpitPanel
        variant="wide"
        chrome={embedded ? "embedded" : "panel"}
        aria-label="Payout calendar — awaiting first distribution"
        className="pf-payout-calendar-panel pf-payout-calendar-panel--zero"
      >
        <PfCockpitPanelHeader
          title="Payout Calendar"
          subtitle="Monthly USDC distributions"
          titleVariant="primary"
          trailing={calendarHeaderTrail(leafHref)}
        />
          <div className="pf-distrib-zero-body">
          {showComingBox && nextDate ? (
            /* "Distribution coming" premium box */
            <div className="pf-dc-coming" role="status" aria-label="Next distribution window">
              <div className="pf-dc-coming__header">
                <span className="pf-dc-coming__eyebrow">Distribution coming</span>
                <span className="pf-dc-coming__badge">Estimated</span>
              </div>
              <div className="pf-dc-coming__date-row">
                <span className="pf-dc-coming__date-main">
                  {distribMonthFmt.format(nextDate)}
                </span>
                <span className="pf-dc-coming__date-exact">
                  ~{distribDateFmt.format(nextDate)}
                </span>
              </div>
              <div className="pf-dc-coming__context">
                <span className="pf-dc-coming__rule">Monthly · USDC · T+5 settlement</span>
                <span className="pf-dc-coming__caveat">
                  Estimated window — date confirmed at cycle close
                </span>
              </div>
            </div>
          ) : (
            /* No position yet — plain informational state */
            <div className="pf-dc-coming pf-dc-coming--inactive">
              <div className="pf-dc-coming__header">
                <span className="pf-dc-coming__eyebrow">Payout schedule</span>
              </div>
              <p className="pf-dc-coming__inactive-text">
                Monthly USDC distributions begin after your first qualifying cycle.
              </p>
              <p className="pf-dc-coming__caveat">
                Distributions appear here once posted.
              </p>
            </div>
          )}
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
      className="pf-payout-calendar-panel"
    >
      {header}
      <div className="pf-distrib-chart-shell">
        <BarChart
          entries={buildTwelveMonthAxis(entries, now)}
          refYear={refYear}
          currentPeriod={currentPeriod}
        />
      </div>
      {calendarFooter}
    </PfCockpitPanel>
  );
}
