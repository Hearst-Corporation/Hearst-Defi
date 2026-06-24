import { formatUsdCompact } from "@/lib/vaults/product-display";
import {
  PfCockpitPanel,
  PfCockpitPanelHeader,
} from "@/components/portfolio/pf-cockpit-panel";
import { resolveProvenance } from "@/lib/portfolio/provenance";
import { cn } from "@/lib/cn";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";

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
      <header className="pf-cockpit-panel__header px-6 pt-6 pb-2">
        <div className="flex flex-col gap-1.5">
          <h2 className="pf-cockpit-panel__title--primary tracking-[0.2em] opacity-90">Portfolio Status</h2>
          {provenance && (
            <div className="flex items-center gap-2">
              <ProvenanceBadge kind={provenance} compact />
              <span className="text-[9px] uppercase tracking-[0.15em] text-tertiary font-bold opacity-50">Verified Proof</span>
            </div>
          )}
        </div>
      </header>
      <dl className="pf-status-list px-4 pb-6">
        {rows.map((r) => (
          <div key={r.key} className="pf-status-row group">
            <span className="pf-status-row__dot" aria-hidden="true" />
            <div className="flex flex-col min-w-0">
              <dt className="pf-status-row__label text-[11px] uppercase tracking-[0.12em] group-hover:text-strong transition-colors">
                {r.label}
              </dt>
              <span className="pf-status-row__meta text-[10px] opacity-60 group-hover:opacity-100 transition-opacity">
                {r.meta}
              </span>
            </div>
            <dd className="pf-status-row__trail">
              {r.value !== DASH ? (
                <span
                  className={cn(
                    "pf-status-row__value tabular text-base font-bold",
                    r.valueAccent ? "text-accent" : "text-strong"
                  )}
                >
                  {r.value}
                </span>
              ) : (
                <span className="text-tertiary opacity-40">{DASH}</span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </PfCockpitPanel>
  );
}
