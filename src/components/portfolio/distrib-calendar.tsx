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

import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { cn } from "@/lib/cn";
import { explorerTxUrl } from "@/lib/chain/client";
import { resolveProvenance } from "@/lib/portfolio/provenance";

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

/** Format USDC amount as compact string, e.g. 2310 → "$2,310" */
export function formatUsdc(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(amount);
}

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

// ── SVG component ─────────────────────────────────────────────────────────────

interface BarChartProps {
  entries: DistribEntry[];
  refYear: number;
  currentPeriod: string;
}

function BarChart({ entries, refYear, currentPeriod }: BarChartProps) {
  const n = entries.length;
  if (n === 0) return null;

  const maxAmount = Math.max(...entries.map((e) => e.amountUsdc), 1);

  // Bar geometry
  const GAP = 4;
  const totalGaps = (n - 1) * GAP;
  const BAR_W = Math.floor((VB_W - totalGaps) / n);
  // Unique IDs for SVG defs (static — RSC renders once per request)
  const forecastPatternId = "dc-forecast-hatch";
  const titleId = "dc-title";

  // max-h-[180px] below: render constraint, not a spacing token — caps the SVG
  // canvas height so the chart can't grow taller than its cell. Intentional
  // arbitrary value (chart dimension, off the --ct-space-* scale).
  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      preserveAspectRatio="xMidYMid meet"
      className="w-full max-h-44"
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
              fontSize="6"
              fill="var(--ct-status-warning)"
              fontFamily="var(--font-mono)"
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
                fontSize="7"
                fill="var(--ct-accent)"
                className="ct-donut-slice-glow"
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
              fontSize="7"
              fill={isCurrent ? "var(--ct-accent)" : "var(--ct-text-muted)"}
              fontFamily="var(--font-mono)"
              aria-hidden="true"
            >
              {periodLabel}
            </text>

            {/* Amount label */}
            <text
              x={cx}
              y={AMOUNT_Y}
              textAnchor="middle"
              fontSize="6.5"
              fill="var(--ct-text-primary)"
              fontFamily="var(--font-mono)"
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
}: DistribCalendarProps) {
  const now = asOf ?? new Date();
  const refYear = now.getUTCFullYear();

  // Derive current month period string "YYYY-MM"
  const currentPeriod = `${refYear}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

  const hasEntries = entries.length > 0;
  const hasForecast = entries.some((e) => e.paidAt === null);

  const badgeKind =
    hasEntries && source === "live"
      ? "attested"
      : resolveProvenance(source, updatedAt, "estimated");

  return (
    <article
      aria-label="Payout calendar"
      className={cn(
        "dash-cell dash-cell-premium flex flex-col gap-3 h-full",
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 relative z-10">
        <div className="flex flex-col gap-0.5">
          <h3 className="h3 mb-0">
            PAYOUT CALENDAR
          </h3>
          <p className="body-xs ct-text-muted mono">
            12-month history · USDC
          </p>
        </div>

        {/* Provenance badges */}
        <div className="flex items-center gap-1.5 shrink-0">
          <ProvenanceBadge kind={badgeKind} />
          {hasForecast && (
            <ProvenanceBadge kind="estimated" />
          )}
        </div>
      </div>

      {/* Chart */}
      {hasEntries ? (
        <div className="w-full overflow-hidden rounded-md relative z-10">
          <BarChart
            entries={entries}
            refYear={refYear}
            currentPeriod={currentPeriod}
          />
        </div>
      ) : (
        <div
          className="flex items-center justify-center rounded-md border border-dashed border-(--ct-border-soft) ct-surface-1 relative z-10 min-h-32"
          aria-label="No distribution data yet"
        >
          <p className="text-xs ct-text-muted">
            No distribution history yet.
          </p>
        </div>
      )}

      {/* Footer — share class + cadence */}
      <dl className="flex flex-wrap gap-x-6 gap-y-2 border-t border-(--ct-border-soft) pt-4 mt-auto relative z-10">
        <div className="flex flex-col gap-0.5 min-w-0">
          <dt className="stat-label mono">
            Share class
          </dt>
          <dd className="body-sm ct-text-body mono tabular">
            {shareClass ? `Series ${shareClass}` : "—"}
          </dd>
        </div>
        <div className="flex flex-col gap-0.5 min-w-0">
          <dt className="stat-label mono">
            Cadence
          </dt>
          <dd className="body-sm ct-text-body mono tabular">
            {cadence ?? "—"}
          </dd>
        </div>
      </dl>
    </article>
  );
}
