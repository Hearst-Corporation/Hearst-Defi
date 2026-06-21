import type { ReactElement } from "react";

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
  icon: ReactElement;
  label: string;
  value: string;
  valueAccent?: boolean;
  meta: string;
}

/* Minimal stroked glyphs (1.6 stroke, currentColor) — match the mockup's quiet
   line-icons. svg-geometry: viewBox + path coords are raw by SVG spec. */
const ICONS = {
  deployment: (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3a9 9 0 1 0 9 9" />
      <path d="M12 3v9l6 4" />
    </svg>
  ),
  positions: (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="4" rx="1" />
      <rect x="3" y="10" width="18" height="4" rx="1" />
      <rect x="3" y="16" width="18" height="4" rx="1" />
    </svg>
  ),
  yield: (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M21 7v5h-5" />
    </svg>
  ),
  deposits: (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v10M9.5 9.2c0-1.1 1.1-1.8 2.5-1.8s2.5.7 2.5 1.8-1.1 1.6-2.5 1.8-2.5.7-2.5 1.8 1.1 1.8 2.5 1.8 2.5-.7 2.5-1.8" />
    </svg>
  ),
  proof: (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l7 3v6c0 4.4-3 7.4-7 9-4-1.6-7-4.6-7-9V6z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  ),
} as const;

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
      icon: ICONS.deployment,
      label: "Deployment",
      value: hasPositions ? `${deploymentPct.toFixed(1)}%` : DASH,
      meta: hasPositions
        ? `${formatUsdCompact(deployedUsdc)} deployed`
        : "Awaiting first confirmed on-chain position",
    },
    {
      key: "positions",
      icon: ICONS.positions,
      label: "Positions",
      value: hasPositions ? String(positionsCount) : DASH,
      meta: hasPositions ? "Active" : "None yet",
    },
    {
      key: "yield",
      icon: ICONS.yield,
      label: "Accrued yield",
      value: hasPositions ? formatUsdCompact(accruedYieldUsdc) : DASH,
      valueAccent: hasPositions,
      meta: "Since inception",
    },
    {
      key: "deposits",
      icon: ICONS.deposits,
      label: "Net deposits",
      value: hasPositions ? formatUsdCompact(deployedUsdc) : DASH,
      meta: "Principal subscribed",
    },
    {
      key: "proof",
      icon: ICONS.proof,
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
            <span className="pf-status-row__icon" aria-hidden="true">
              {r.icon}
            </span>
            <dt className="pf-status-row__label">{r.label}</dt>
            <dd className="pf-status-row__trail">
              <span
                className={cn(
                  "pf-status-row__value tabular",
                  r.valueAccent && "ct-text-accent"
                )}
              >
                {r.value}
              </span>
              <span className="pf-status-row__meta">{r.meta}</span>
            </dd>
          </div>
        ))}
      </dl>
    </PfCockpitPanel>
  );
}
