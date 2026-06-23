import { DashboardPanelHeader } from "@/components/ui/dashboard-panel-header";
import type { ReactElement } from "react";

import { formatUsdCompact } from "@/lib/vaults/product-display";
import {
  PfCockpitPanel,
} from "@/components/portfolio/pf-cockpit-panel";
import { attestationState } from "@/components/portfolio/proof-pulse";
import { resolveProvenance } from "@/lib/portfolio/provenance";
import { cn } from "@/lib/cn";

const DASH = "—";

const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

/* Minimal stroked glyphs (1.6 stroke, currentColor) — shown in the circled badge
   on wide layouts; collapse to a plain accent dot when the panel narrows.
   svg-geometry: viewBox + path coords are raw by SVG spec. */
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
  totalValue: (
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

/** PoR snapshot for the underlying-proof row — not the portfolio DB source flag. */
export interface PortfolioStatusProofProps {
  statedTvlUsdc: number;
  onChainTvlUsdc: number;
  timestamp?: Date;
  source?: "live" | "stale" | "attested";
}

export interface PortfolioStatusPanelProps {
  hasPositions: boolean;
  positionsCount: number;
  /** principal currently deployed into vaults (USDC) */
  deployedUsdc: number;
  /** principal + accrued (total value) */
  totalValueUsdc: number;
  /** accrued yield since inception (USDC) */
  accruedYieldUsdc: number;
  source: "live" | "fallback";
  updatedAt?: Date;
  proof?: PortfolioStatusProofProps;
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

/** Maps PoR figures to an honest LP-facing label (never "Live" for DB reads). */
export function underlyingProofLabel(
  proof: PortfolioStatusProofProps | undefined,
): { value: string; accent: boolean } {
  if (!proof) return { value: "Unverified", accent: false };

  const state = attestationState(proof.statedTvlUsdc, proof.onChainTvlUsdc);
  if (proof.source === "attested" || state === "matched") {
    return { value: "Attested", accent: true };
  }
  if (state === "pending") return { value: "Pending", accent: false };
  if (state === "mismatch") return { value: "Review", accent: false };
  return { value: "Unverified", accent: false };
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
  proof,
  embedded = false,
}: PortfolioStatusPanelProps) {
  const provenance = hasPositions ? resolveProvenance(source, updatedAt) : undefined;
  const portfolioAsOf = updatedAt ? `As of ${dateFmt.format(updatedAt)}` : "Awaiting first position";

  const proofLabel = underlyingProofLabel(proof);
  const proofAsOf = proof?.timestamp
    ? `PoR ${dateFmt.format(proof.timestamp)}`
    : portfolioAsOf;

  const totalValueMeta =
    accruedYieldUsdc > 0
      ? `Incl. ${formatUsdCompact(accruedYieldUsdc)} yield`
      : "Principal only";

  const rows: Row[] = [
    {
      key: "deployment",
      icon: ICONS.deployment,
      label: "Capital deployed",
      value: hasPositions ? formatUsdCompact(deployedUsdc) : DASH,
      meta: hasPositions ? "Principal in vault" : "Awaiting first position",
    },
    {
      key: "positions",
      icon: ICONS.positions,
      label: "Positions",
      value: hasPositions ? String(positionsCount) : DASH,
      meta: hasPositions ? (positionsCount === 1 ? "Active position" : "Active positions") : "None yet",
    },
    {
      key: "yield",
      icon: ICONS.yield,
      label: "Accrued yield",
      value: hasPositions ? formatUsdCompact(accruedYieldUsdc) : DASH,
      valueAccent: hasPositions && accruedYieldUsdc > 0,
      meta: "Since inception",
    },
    {
      key: "totalValue",
      icon: ICONS.totalValue,
      label: "Total value",
      value: hasPositions ? formatUsdCompact(totalValueUsdc) : DASH,
      valueAccent: hasPositions && accruedYieldUsdc > 0,
      meta: hasPositions ? totalValueMeta : "—",
    },
  ];

  return (
    <PfCockpitPanel
      variant="wide"
      chrome={embedded ? "embedded" : "panel"}
      aria-label="Portfolio status"
      className={cn("pf-status-panel", !embedded && "pf-status-panel--glass")}
    >
      <DashboardPanelHeader
        title="Portfolio status"
        titleLevel="section"
        tone="quiet"
        provenance={provenance}
      />
      <div className="pf-status-hero">
        <div className="pf-status-hero__item">
          <span className="pf-status-hero__badge-label">Snapshot</span>
          <span className="pf-status-hero__badge-value">
            {hasPositions && updatedAt ? dateFmt.format(updatedAt) : "Pending"}
          </span>
          <span className="pf-status-hero__badge-meta">
            {hasPositions ? "Portfolio sync" : "Awaiting first position"}
          </span>
        </div>
        <div className="pf-status-hero__item">
          <span className="pf-status-hero__badge-label">Proof status</span>
          <span
            className={cn(
              "pf-status-hero__badge-value",
              hasPositions && proofLabel.accent && "pf-status-hero__badge-value--accent",
            )}
          >
            {hasPositions ? proofLabel.value : "Pending"}
          </span>
          <span className="pf-status-hero__badge-meta">
            {hasPositions ? proofAsOf : portfolioAsOf}
          </span>
        </div>
      </div>
      <dl className="pf-status-list">
        {rows.map((r) => (
          <div key={r.key} className="pf-status-row">
            <span className="pf-status-row__icon" aria-hidden="true">
              {r.icon}
            </span>
            <span className="pf-status-row__dot" aria-hidden="true" />
            <dt className="pf-status-row__label">{r.label}</dt>
            <dd className="pf-status-row__trail">
              {r.value !== DASH ? (
                <span
                  className={cn(
                    "pf-status-row__value",
                    r.valueAccent && "pf-status-row__value--accent"
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
