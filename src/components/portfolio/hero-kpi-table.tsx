import { ProvenanceBadge, type Provenance } from "@/components/ui/provenance-badge";
import { formatUsdCompact } from "@/lib/vaults/product-display";
import { resolveProvenance } from "@/lib/portfolio/provenance";
import type { WidgetMode } from "@/lib/portfolio/view-state";

import { HeroRailGroup } from "@/components/portfolio/hero-rail-shell";

export interface HeroKpiTableProps {
  totalValueUsdc: number;
  totalYieldYtdUsdc: number;
  nextDistributionAt: Date;
  hasPositions: boolean;
  source: "live" | "fallback";
  updatedAt?: Date;
  previewZeros?: boolean;
  /** Loader-resolved mode (authoritative). Falls back to previewZeros/hasPositions. */
  mode?: WidgetMode;
}

const usdFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

function prov(
  isZero: boolean,
  source: "live" | "fallback",
  updatedAt: Date | undefined,
  preferred: Provenance,
): Provenance | undefined {
  return isZero ? undefined : resolveProvenance(source, updatedAt, preferred);
}

/**
 * Hero rail — key metrics. Recoded from scratch: a tight 3-row stat list
 * (position value · yield YTD · next distribution), each row a label + value
 * with an inline provenance dot. Honest zero-state collapses to one line.
 */
export function HeroKpiTable({
  totalValueUsdc,
  totalYieldYtdUsdc,
  nextDistributionAt,
  hasPositions,
  source,
  updatedAt,
  previewZeros = false,
  mode,
}: HeroKpiTableProps) {
  const isZero = mode ? mode === "zero" : previewZeros || !hasPositions;

  if (isZero) {
    return (
      <HeroRailGroup title="Portfolio metrics" aria-label="Portfolio metrics" slot="metrics">
        <p className="pf-hero-rail-blurb body-xs ct-text-muted m-0">
          No position yet — metrics appear after your first confirmed deposit.
        </p>
      </HeroRailGroup>
    );
  }

  const now = new Date();
  const diffDays = Math.ceil(
    Math.max(0, nextDistributionAt.getTime() - now.getTime()) / 86_400_000,
  );

  const rows: Array<{ label: string; value: string; unit?: string; badge?: Provenance; chip?: string }> = [
    {
      label: "Position value",
      value: usdFmt.format(totalValueUsdc),
      unit: "USDC",
      badge: prov(isZero, source, updatedAt, "live"),
    },
    {
      label: "Yield YTD",
      value: formatUsdCompact(totalYieldYtdUsdc),
      unit: "USDC",
      badge: prov(isZero, source, updatedAt, "estimated"),
    },
    {
      label: "Next distribution",
      value: dateFmt.format(nextDistributionAt),
      badge: prov(isZero, source, updatedAt, "estimated"),
      chip: diffDays > 0 ? `${diffDays}d` : undefined,
    },
  ];

  return (
    <HeroRailGroup title="Key metrics" aria-label="Key metrics summary" slot="metrics">
      <dl className="pf-hero-rail-list">
        {rows.map((r) => (
          <div key={r.label} className="pf-hero-rail-row">
            <dt className="pf-hero-rail-row__label stat-label">
              <span>{r.label}</span>
              {r.badge ? <ProvenanceBadge kind={r.badge} variant="strip" compact /> : null}
            </dt>
            <dd className="pf-hero-rail-row__value m-0">
              <span className="pf-hero-rail-kpi tabular-nums">{r.value}</span>
              {r.unit ? <span className="pf-kpi-unit">{r.unit}</span> : null}
              {r.chip ? <span className="pf-chip-accent shrink-0">{r.chip}</span> : null}
            </dd>
          </div>
        ))}
      </dl>
    </HeroRailGroup>
  );
}
