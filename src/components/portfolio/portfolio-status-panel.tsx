import { formatUsdCompact } from "@/lib/vaults/product-display";
import {
  PfCockpitPanel,
  PfCockpitPanelHeader,
} from "@/components/portfolio/pf-cockpit-panel";
import { resolveProvenance } from "@/lib/portfolio/provenance";
import { cn } from "@/lib/cn";

const DASH = "—";

const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

export interface PortfolioStatusPanelProps {
  hasPositions: boolean;
  positionsCount: number;
  /** principal currently deployed into vaults (USDC) */
  deployedUsdc: number;
  /** principal + accrued (total value) — denominator for deployment % */
  totalValueUsdc: number;
  /** accrued yield since inception (USDC) */
  accruedYieldUsdc: number;
  /** provenance of the underlying proof (live → "Current", else pending/stale) */
  source: "live" | "fallback";
  updatedAt?: Date;
  embedded?: boolean;
}

interface Row {
  key: string;
  label: string;
  value: string;
  valueAccent?: boolean;
  meta: string;
}

/**
 * Hero sidebar — "Portfolio status" panel. Five line-item rows
 * (icon · label · value · sub-meta). Honest zero-state: em-dash values, no fabricated metrics.
 */
export function PortfolioStatusPanel({
  hasPositions,
  positionsCount,
  deployedUsdc,
  totalValueUsdc,
  accruedYieldUsdc,
  source,
  updatedAt,
  embedded = false,
}: PortfolioStatusPanelProps) {
  const deploymentPct =
    hasPositions && totalValueUsdc > 0
      ? Math.min(100, (deployedUsdc / totalValueUsdc) * 100)
      : 0;

  const provenance = hasPositions ? resolveProvenance(source, updatedAt) : undefined;
  const asOf = updatedAt ? `As of ${dateFmt.format(updatedAt)}` : "Awaiting first confirmed on-chain position";

  const rows: Row[] = [
    {
      key: "deployment",
      label: "Deployment",
      value: hasPositions ? `${deploymentPct.toFixed(1)}%` : DASH,
      meta: hasPositions
        ? `${formatUsdCompact(deployedUsdc)} deployed`
        : "Awaiting first confirmed on-chain position",
    },
    {
      key: "positions",
      label: "Positions",
      value: hasPositions ? String(positionsCount) : DASH,
      meta: hasPositions ? "Active" : "None yet",
    },
    {
      key: "yield",
      label: "Accrued yield",
      value: hasPositions ? formatUsdCompact(accruedYieldUsdc) : DASH,
      valueAccent: hasPositions,
      meta: "Since inception",
    },
    {
      key: "deposits",
      label: "Net deposits",
      value: hasPositions ? formatUsdCompact(deployedUsdc) : DASH,
      meta: "Principal subscribed",
    },
    {
      key: "proof",
      label: "Underlying proof",
      value: hasPositions ? (source === "live" ? "Current" : "Pending") : DASH,
      meta: asOf,
    },
  ];

  return (
    <PfCockpitPanel
      variant="wide"
      chrome={embedded ? "embedded" : "panel"}
      aria-label="Portfolio status"
      className="pf-status-panel"
    >
      <PfCockpitPanelHeader
        title="Portfolio status"
        titleVariant="primary"
        provenance={provenance}
      />
      <dl className="pf-status-list">
        {rows.map((r) => (
          <div key={r.key} className="pf-status-row">
            <span className="pf-status-row__dot" aria-hidden="true" />
            <dt className="pf-status-row__label">{r.label}</dt>
            <dd className="pf-status-row__trail">
              {r.value !== DASH ? (
                <span
                  className={cn(
                    "pf-status-row__value tabular",
                    r.valueAccent && "ct-text-accent"
                  )}
                >
                  {r.value}
                </span>
              ) : null}
              <span className="pf-status-row__meta">{r.meta}</span>
            </dd>
          </div>
        ))}
      </dl>
    </PfCockpitPanel>
  );
}
