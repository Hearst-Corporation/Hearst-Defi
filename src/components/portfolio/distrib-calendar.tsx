import { useId } from "react";
import { DashboardPanelHeader } from "@/components/ui/dashboard-panel-header";
import { explorerTxUrl, isPlaceholderTxHash } from "@/lib/chain/client";
import { resolveProvenance } from "@/lib/portfolio/provenance";
import { barHeight as barHeightIn, barX as barXIn } from "@/lib/portfolio/geometry";
import { PortfolioLeafLink } from "@/components/portfolio/portfolio-leaf-link";
import { formatUsdFull } from "@/lib/vaults/product-display";
import { PfCockpitPanel } from "@/components/portfolio/pf-cockpit-panel";

export interface DistribEntry {
  period: string;
  amountUsdc: number;
  paidAt: Date | null;
  txHash?: string;
}

export interface DistribCalendarProps {
  entries: DistribEntry[];
  shareClass: string | null;
  cadence: string | null;
  asOf?: Date;
  source?: "live" | "stale";
  updatedAt?: Date;
  leafHref?: string;
  secondaryLeafHref?: string;
  secondaryLeafLabel?: string;
  embedded?: boolean;
}

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

const VB_W = 560;
const VB_H = 180;
const BAR_AREA_TOP = 8;
const BAR_AREA_BOT = 140;
const BAR_AREA_H = BAR_AREA_BOT - BAR_AREA_TOP;
const LABEL_Y = BAR_AREA_BOT + 14;
const AMOUNT_Y = BAR_AREA_BOT + 28;
const BAR_FILL = "color-mix(in srgb, var(--ct-surface-3) 92%, var(--ct-text-strong) 8%)";
const BAR_STROKE = "color-mix(in srgb, var(--ct-text-strong) 10%, transparent)";

export function barX(index: number, total: number, barW: number, gapW: number): number {
  return barXIn(index, total, barW, gapW, VB_W);
}

export function barHeight(amount: number, maxAmount: number): number {
  return barHeightIn(amount, maxAmount, BAR_AREA_H);
}

const COMPACT_LABEL_INDICES = [0, 3, 6, 9] as const;

export function shouldShowCompactPeriodLabel(index: number): boolean {
  return (COMPACT_LABEL_INDICES as readonly number[]).includes(index);
}

interface BarChartProps {
  entries: DistribEntry[];
  refYear: number;
  currentPeriod: string;
  skeleton?: boolean;
}

function SkeletonBars() {
  const n = 12;
  const GAP = 4;
  const BAR_W = Math.floor((VB_W - (n - 1) * GAP) / n);
  const HEIGHTS = [6, 9, 7, 11, 8, 12, 9, 13, 10, 12, 9, 11];
  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      preserveAspectRatio="xMidYMax meet"
      className="pf-distrib-chart pf-distrib-chart--skeleton block h-full w-full"
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
            rx="1"
            aria-hidden="true"
          />
        );
      })}
    </svg>
  );
}

function BarChart({
  entries,
  refYear,
  currentPeriod,
  skeleton = false,
}: BarChartProps) {
  const uid = useId();
  const n = entries.length;
  if (skeleton || n === 0) return <SkeletonBars />;

  const GAP = 4;
  const totalGaps = (n - 1) * GAP;
  const BAR_W = Math.floor((VB_W - totalGaps) / n);
  const forecastPatternId = `${uid}-forecast-hatch`;
  const titleId = `${uid}-title`;

  const maxAmount = Math.max(...entries.map((e) => e.amountUsdc), 1);

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      preserveAspectRatio="xMidYMax meet"
      className="pf-distrib-chart block h-full w-full"
      role="img"
      aria-labelledby={titleId}
    >
      <title id={titleId}>{`Payout calendar — ${n} periods`}</title>

      <defs>
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
          <g key={i} role="img" aria-label={`Forecast ${periodLabel} — ${amountLabel} (Estimated)`}>
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
              fill={BAR_FILL}
              stroke={isCurrent ? "var(--ct-accent)" : BAR_STROKE}
              strokeWidth={isCurrent ? "1" : "0.75"}
              style={{ opacity: 1 }}
              rx="1"
            />
          </a>
        ) : (
          <rect
            key={i}
            x={bx}
            y={by}
            width={BAR_W}
            height={bh}
            fill={BAR_FILL}
            stroke={isCurrent ? "var(--ct-accent)" : BAR_STROKE}
            strokeWidth={isCurrent ? "1" : "0.75"}
            style={{ opacity: 1 }}
            rx="1"
            aria-label={`${periodLabel} distribution ${amountLabel}`}
          />
        );

        return (
          <g key={i}>
            {barEl}
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
  const chrome = embedded ? ("embedded" as const) : ("panel" as const);
  const now = asOf ?? new Date();
  const refYear = now.getUTCFullYear();
  const currentPeriod = `${refYear}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const hasEntries = entries.length > 0;
  const hasForecast = entries.some((e) => e.paidAt === null);
  const latestPaidEntry = [...entries].reverse().find((e) => e.paidAt !== null) ?? null;
  const forecastEntry = entries.find((e) => e.paidAt === null) ?? null;

  if (!hasEntries) {
    return (
      <PfCockpitPanel
        variant="wide"
        chrome={chrome}
        aria-label="Payout calendar — awaiting first distribution"
        className="pf-payout-calendar-panel pf-payout-calendar-panel--zero h-full"
      >
        <DashboardPanelHeader
          title="Payout Calendar"
          subtitle="Monthly USDC distributions"
          tone="primary"
          trailing={calendarHeaderTrail(leafHref)}
        />
        <div className="pf-distrib-chart-shell">
          <BarChart entries={[]} refYear={refYear} currentPeriod={currentPeriod} skeleton />
        </div>
      </PfCockpitPanel>
    );
  }

  const liveProvenance = source === "live"
    ? ("attested" as const)
    : resolveProvenance(source, updatedAt, "estimated");

  const header = (
    <DashboardPanelHeader
      title="Payout Calendar"
      subtitle={`12m · USDC${hasForecast ? " · forecast" : ""}`}
      provenance={liveProvenance}
      trailing={calendarHeaderTrail(leafHref, secondaryLeafHref, secondaryLeafLabel)}
    />
  );

  const calendarSummary = (
    <dl className="pf-calendar-summary">
      {latestPaidEntry ? (
        <div className="pf-calendar-summary__item pf-calendar-summary__item--amount">
          <dt>Latest paid</dt>
          <dd>{formatUsdFull(latestPaidEntry.amountUsdc)}</dd>
          <span>{formatPeriod(latestPaidEntry.period, refYear)}</span>
        </div>
      ) : null}
      {forecastEntry ? (
        <div className="pf-calendar-summary__item pf-calendar-summary__item--amount">
          <dt>Forecast</dt>
          <dd>~{formatUsdFull(forecastEntry.amountUsdc)}</dd>
          <span>{formatPeriod(forecastEntry.period, refYear)}</span>
        </div>
      ) : null}
      {shareClass ? (
        <div className="pf-calendar-summary__item pf-calendar-summary__item--meta">
          <dt>Share class</dt>
          <dd>Series {shareClass}</dd>
          <span>{cadence ?? "Distribution cadence"}</span>
        </div>
      ) : cadence ? (
        <div className="pf-calendar-summary__item pf-calendar-summary__item--meta">
          <dt>Cadence</dt>
          <dd>{cadence}</dd>
          <span>Distribution rhythm</span>
        </div>
      ) : null}
    </dl>
  );

  return (
    <PfCockpitPanel
      variant="wide"
      chrome={chrome}
      aria-label="Payout calendar"
      className="pf-payout-calendar-panel h-full"
    >
      {header}
      {calendarSummary}
      <div className="pf-distrib-chart-shell">
        <BarChart
          entries={entries}
          refYear={refYear}
          currentPeriod={currentPeriod}
        />
      </div>
    </PfCockpitPanel>
  );
}
