import { Layers, Wallet, TrendingUp, ArrowDownToLine, ShieldCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { formatUsdCompact } from "@/lib/vaults/product-display";
import {
  PfCockpitPanel,
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

const rows: ReadonlyArray<{
    key: string;
    Icon: LucideIcon;
    label: string;
    value: string;
    valueAccent: boolean;
    meta: string;
  }> = [
    {
      key: "deployment",
      Icon: Layers,
      label: "Deployment",
      value: hasPositions ? `${deploymentPct.toFixed(1)}%` : DASH,
      valueAccent: false,
      meta: hasPositions
        ? `${formatUsdCompact(deployedUsdc)} deployed`
        : "Awaiting first confirmed on-chain position",
    },
    {
      key: "positions",
      Icon: Wallet,
      label: "Positions",
      value: hasPositions ? String(positionsCount) : DASH,
      valueAccent: false,
      meta: hasPositions ? "Active" : "None yet",
    },
    {
      key: "yield",
      Icon: TrendingUp,
      label: "Accrued yield",
      value: hasPositions ? formatUsdCompact(accruedYieldUsdc) : DASH,
      valueAccent: hasPositions,
      meta: "Since inception",
    },
    {
      key: "deposits",
      Icon: ArrowDownToLine,
      label: "Net deposits",
      value: hasPositions ? formatUsdCompact(deployedUsdc) : DASH,
      valueAccent: false,
      meta: "Principal subscribed",
    },
    {
      key: "proof",
      Icon: ShieldCheck,
      label: "Underlying proof",
      value: hasPositions ? (source === "live" ? "Current" : "Pending") : DASH,
      valueAccent: false,
      meta: asOf,
    },
  ];

  return (
    <PfCockpitPanel
      variant="wide"
      chrome={embedded ? "embedded" : "panel"}
      aria-label="Portfolio status"
      className="pf-status-panel !p-0"
    >
      <header className="pf-cockpit-panel__header px-6 py-5 border-b border-[color-mix(in_srgb,var(--ct-border-soft)_20%,transparent)]">
        <div className="flex flex-col gap-1.5">
          <h2 className="text-[10px] uppercase tracking-[0.2em] font-semibold text-secondary">Portfolio Status</h2>
          {provenance && (
            <div className="flex items-center gap-2 mt-1">
              <ProvenanceBadge kind={provenance} compact />
              <span className="text-[9px] uppercase tracking-[0.15em] text-tertiary font-medium opacity-60">Verified Proof</span>
            </div>
          )}
        </div>
      </header>
      <dl className="flex flex-col flex-1 overflow-y-auto px-5">
        {rows.map((r) => (
          <div
            key={r.key}
            className="group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3.5 py-3.5 border-b border-[color-mix(in_srgb,var(--ct-border-soft)_55%,transparent)] last:border-b-0"
          >
            <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-[color-mix(in_srgb,var(--ct-accent)_9%,transparent)] text-accent transition-colors group-hover:bg-[color-mix(in_srgb,var(--ct-accent)_15%,transparent)]">
              <r.Icon size={14} strokeWidth={2} aria-hidden="true" />
            </span>
            <div className="flex flex-col min-w-0">
              <dt className="text-[10px] uppercase tracking-[0.15em] text-secondary font-medium group-hover:text-primary transition-colors">
                {r.label}
              </dt>
              <span className="text-[11px] text-tertiary opacity-60 truncate group-hover:opacity-100 transition-opacity">
                {r.meta}
              </span>
            </div>
            <dd className="text-right">
              {r.value !== DASH ? (
                <span className={cn("tabular text-[16px] font-semibold tracking-tight", r.valueAccent ? "text-accent" : "text-strong")}>
                  {r.value}
                </span>
              ) : (
                <span className="text-tertiary opacity-30 text-lg font-light leading-none">{DASH}</span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </PfCockpitPanel>
  );
}
