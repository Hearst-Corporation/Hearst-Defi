import Link from "next/link";
import { ApyRange } from "@/components/ui/apy-range";
import { Badge } from "@/components/ui/badge";
import { type PortfolioPosition, POSITION_STATUS_CONFIG } from "@/lib/data/portfolio";
import { formatUsdCompact } from "@/lib/vaults/product-display";
import { cn } from "@/lib/cn";
import {
  PfCockpitPanel,
  PfCockpitPanelHeader,
} from "@/components/portfolio/pf-cockpit-panel";
import { Plus, ChevronRight } from "lucide-react";

interface PositionCardsProps {
  positions: PortfolioPosition[];
  leafHref?: string;
  embedded?: boolean;
}

/**
 * PositionCards — Strong Ledger style full-width position cards.
 * Replaces the old pill grid with a stack of imposing cards.
 */
export function PositionCards({
  positions,
  leafHref,
  embedded = false,
}: PositionCardsProps) {
  const hasPositions = positions.length > 0;

  return (
    <PfCockpitPanel
      variant="wide"
      chrome={embedded ? "embedded" : "panel"}
      aria-label={hasPositions ? "Your positions" : "Explore vaults"}
      className="pf-positions-badges"
    >
      <PfCockpitPanelHeader
        title={hasPositions ? "Positions" : "Vaults"}
        titleVariant="primary"
        trailing={
          hasPositions ? (
            <span className="body-xs ct-text-tertiary tabular">
              {positions.length} active
            </span>
          ) : undefined
        }
      />

      <div className="pf-positions-stack flex flex-col gap-3 px-4 pb-4">
        {hasPositions ? (
          positions.map((p) => {
            const statusConfig = POSITION_STATUS_CONFIG[p.status];
            return (
              <Link
                key={p.id}
                href={`/portfolio/${p.id}`}
                className={cn(
                  "pf-position-card group relative flex items-center justify-between p-4 rounded-xl bg-[color-mix(in_srgb,var(--ct-surface-1)_60%,transparent)] border border-[color-mix(in_srgb,var(--ct-border-soft)_15%,transparent)] shadow-[inset_0_1px_0_color-mix(in_srgb,var(--ct-surface-0)_20%,transparent),0_4px_16px_-4px_color-mix(in_srgb,var(--ct-surface-0)_40%,transparent)] transition-all duration-300 hover:bg-[color-mix(in_srgb,var(--ct-surface-2)_60%,transparent)] hover:border-[color-mix(in_srgb,var(--ct-border-soft)_30%,transparent)] hover:translate-y-[-2px] hover:shadow-[0_8px_24px_-4px_color-mix(in_srgb,var(--ct-surface-0)_60%,transparent)] overflow-hidden",
                  p.status === "active" && "pf-position-card--active ring-1 ring-[color-mix(in_srgb,var(--ct-accent)_20%,transparent)]"
                )}
              >
                {p.status === "active" && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-[color-mix(in_srgb,var(--ct-accent)_80%,transparent)] to-[color-mix(in_srgb,var(--ct-accent)_20%,transparent)] shadow-[4px_0_12px_color-mix(in_srgb,var(--ct-accent)_40%,transparent)]" aria-hidden />
                )}
                <span className="flex flex-col min-w-0 pl-2">
                  <span className="flex items-center gap-2.5 mb-1.5">
                    <span className="text-[var(--ct-text-14)] font-semibold text-strong tracking-tight truncate group-hover:text-accent transition-colors">
                      {p.vaultName ?? "Vault"}
                    </span>
                    <Badge variant={statusConfig.variant}>
                      {statusConfig.label}
                    </Badge>
                  </span>
                  <span className="flex items-center gap-4">
                    <span className="flex items-center gap-1.5">
                      <span className="text-[var(--ct-text-deci)] uppercase tracking-wider text-tertiary font-medium">Pos</span>
                      <span className="text-[var(--ct-text-xs)] font-bold text-secondary tabular tracking-tight">
                        {formatUsdCompact(p.valueUsdc)}
                      </span>
                    </span>
                    {p.apyLow !== null && p.apyHigh !== null && (
                      <>
                        <span className="w-1 h-1 rounded-full bg-[color-mix(in_srgb,var(--ct-border-soft)_40%,transparent)]" aria-hidden />
                        <span className="flex items-center gap-1.5">
                          <span className="text-[var(--ct-text-deci)] uppercase tracking-wider text-tertiary font-medium">APY</span>
                          <ApyRange
                            low={p.apyLow}
                            high={p.apyHigh}
                            className="text-[var(--ct-text-xs)] font-bold text-strong tracking-tight"
                          />
                        </span>
                      </>
                    )}
                  </span>
                </span>

                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-[color-mix(in_srgb,var(--ct-surface-2)_40%,transparent)] border border-[color-mix(in_srgb,var(--ct-border-soft)_20%,transparent)] text-tertiary group-hover:text-strong group-hover:bg-[color-mix(in_srgb,var(--ct-surface-3)_60%,transparent)] transition-colors">
                  <ChevronRight size={16} strokeWidth={2.5} aria-hidden="true" />
                </span>
              </Link>
            );
          })
        ) : (
          <Link
            href="/vaults"
            className="group flex items-center justify-between py-3 transition-colors"
          >
            <span className="flex flex-col min-w-0">
              <span className="text-[var(--ct-text-14)] font-semibold text-secondary tracking-tight group-hover:text-accent transition-colors">Explore Opportunities</span>
              <span className="text-[var(--ct-text-2xs)] text-tertiary opacity-80">No active positions</span>
            </span>
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-[color-mix(in_srgb,var(--ct-surface-1)_60%,transparent)] border border-[color-mix(in_srgb,var(--ct-border-soft)_20%,transparent)] text-secondary group-hover:text-accent group-hover:bg-[color-mix(in_srgb,var(--ct-accent)_10%,transparent)] transition-colors">
              <Plus size={16} strokeWidth={2.5} aria-hidden="true" />
            </span>
          </Link>
        )}

        {hasPositions && leafHref && (
          <Link href={leafHref} className="group flex items-center justify-center gap-2 p-3 mt-1 rounded-lg bg-[color-mix(in_srgb,var(--ct-surface-1)_30%,transparent)] border border-[color-mix(in_srgb,var(--ct-border-soft)_10%,transparent)] hover:bg-[color-mix(in_srgb,var(--ct-surface-2)_50%,transparent)] transition-colors">
            <span className="text-[var(--ct-text-micro)] uppercase tracking-wider font-semibold text-secondary group-hover:text-primary transition-colors">View all positions</span>
            <ChevronRight size={14} className="text-tertiary group-hover:text-primary transition-colors" />
          </Link>
        )}
      </div>
    </PfCockpitPanel>
  );
}
