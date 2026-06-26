import { ValueChart } from "@/components/portfolio/value-chart";
import { PortfolioStatusPanel } from "@/components/portfolio/portfolio-status-panel";
import { resolveProvenance } from "@/lib/portfolio/provenance";
import type { HourlyValueSnapshot, ValueSeriesTx } from "@/lib/portfolio/value-series";

const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

interface PortfolioHeroPosition {
  id: string;
  vaultName?: string | null;
  principalUsdc?: number;
  accruedYieldUsdc?: number;
  distributedUsdc?: number;
  valueUsdc?: number;
  status?: string;
  apyLow?: number | null;
  apyHigh?: number | null;
  subscribedAt?: Date;
}

export interface PortfolioHeroProps {
  hasPositions: boolean;
  positions: PortfolioHeroPosition[];
  totalValueUsdc: number;
  deployedUsdc: number;
  accruedYieldUsdc: number;
  positionsCount: number;
  source: "live" | "fallback";
  updatedAt?: Date;
  valueChartTransactions?: ValueSeriesTx[];
  hourlySnapshots?: HourlyValueSnapshot[];
}

export function PortfolioHero({
  hasPositions,
  positions,
  totalValueUsdc,
  deployedUsdc,
  accruedYieldUsdc,
  positionsCount,
  source,
  updatedAt,
  valueChartTransactions,
  hourlySnapshots,
}: PortfolioHeroProps) {
  const isEmpty = totalValueUsdc === 0 && positionsCount === 0;
  const provenance = isEmpty ? undefined : resolveProvenance(source, updatedAt, "estimated");
  const provenanceLabel = provenance === "live" ? "Live NAV" : "Estimated NAV";
  const formattedDate = updatedAt ? dateFmt.format(updatedAt) : null;

  return (
    <div className="pf-hero-grid pf-cockpit-cell" aria-label="Portfolio overview">
      <header className="pf-hero-header">
        <div className="pf-hero-header__row">
          <h2 className="pf-cockpit-panel__title--primary">Portfolio Value</h2>
          {!isEmpty && provenance ? (
            <span className="pf-hero-header__provenance">{provenanceLabel}</span>
          ) : null}
          {formattedDate ? (
            <time className="pf-hero-header__date" dateTime={updatedAt?.toISOString()}>
              {formattedDate}
            </time>
          ) : null}
        </div>
      </header>

      <div className="pf-hero-body">
        <div className="pf-main-chart-wrapper">
          <ValueChart
            heroPane="left"
            positions={positions}
            totalValueUsdc={totalValueUsdc}
            valueChartTransactions={valueChartTransactions}
            hourlySnapshots={hourlySnapshots}
            source={source}
            updatedAt={updatedAt}
            embedded
          />
        </div>

        <PortfolioStatusPanel
          hasPositions={hasPositions}
          positionsCount={positionsCount}
          deployedUsdc={deployedUsdc}
          totalValueUsdc={totalValueUsdc}
          accruedYieldUsdc={accruedYieldUsdc}
          source={source}
          embedded
          updatedAt={updatedAt}
        />
      </div>
    </div>
  );
}
