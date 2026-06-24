import Link from "next/link";
import { ApyRange } from "@/components/ui/apy-range";
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

      <div className="pf-positions-stack flex flex-col gap-[var(--ct-space-2_5)] px-[var(--ct-space-4)] pb-[var(--ct-space-4)]">
        {hasPositions ? (
          positions.map((p, idx) => {
            const statusConfig = POSITION_STATUS_CONFIG[p.status];
            const isActive = p.status === "active";
            return (
              <Link
                key={p.id}
                href={`/portfolio/${p.id}`}
                className={cn(
                  "pf-position-card group relative overflow-hidden",
                  isActive && "pf-position-card--active"
                )}
                style={{ animationDelay: `${idx * 0.07}s` }}
              >
                {/* Active left accent bar */}
                {isActive && (
                  <div className="pf-position-card__accent-bar" aria-hidden />
                )}

                {/* Main content */}
                <div className="flex items-center justify-between pl-[var(--ct-space-3)] pr-[var(--ct-space-2)] py-[var(--ct-space-3)]">
                  <div className="flex flex-col min-w-0 flex-1 gap-[var(--ct-space-1_5)]">
                    {/* Row 1 — vault name + status chip */}
                    <div className="flex items-center gap-[var(--ct-space-2_5)]">
                      <span className="text-[length:var(--ct-text-sm)] font-semibold text-strong tracking-tight truncate group-hover:text-accent transition-colors">
                        {p.vaultName ?? "Vault"}
                      </span>
                      <span className={cn(
                        "pf-position-status-chip",
                        isActive && "pf-position-status-chip--active"
                      )}>
                        {statusConfig.label}
                      </span>
                    </div>
                    {/* Row 2 — position value + APY */}
                    <div className="flex items-center gap-[var(--ct-space-5)]">
                      <div className="flex flex-col min-w-0">
                        <span className="text-[length:var(--ct-text-nano)] uppercase tracking-[var(--ct-tracking-widest)] text-tertiary font-medium mb-[var(--ct-space-0_5)]">Position</span>
                        <span className="text-[length:var(--ct-text-base)] font-bold tabular tracking-tight text-secondary">
                          {formatUsdCompact(p.valueUsdc)}
                        </span>
                      </div>
                      {p.apyLow !== null && p.apyHigh !== null && (
                        <>
                          <div className="w-px h-[2rem] bg-[color-mix(in_srgb,var(--ct-border-soft)_30%,transparent)]" aria-hidden />
                          <div className="flex flex-col min-w-0">
                            <span className="text-[length:var(--ct-text-nano)] uppercase tracking-[var(--ct-tracking-widest)] text-tertiary font-medium mb-[var(--ct-space-0_5)]">Target APY</span>
                            <ApyRange
                              low={p.apyLow}
                              high={p.apyHigh}
                              className="text-[length:var(--ct-text-sm)] font-bold text-strong tracking-tight"
                            />
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Chevron */}
                  <span className="pf-position-card__chevron flex items-center justify-center w-[var(--ct-space-8)] h-[var(--ct-space-8)] rounded-full border border-[color-mix(in_srgb,var(--ct-border-soft)_20%,transparent)] transition-all duration-200 flex-shrink-0 ml-[var(--ct-space-2)]">
                    <ChevronRight size={15} strokeWidth={2} aria-hidden="true" />
                  </span>
                </div>
              </Link>
            );
          })
        ) : (
          <div className="pf-positions-empty-premium">
            <div className="pf-positions-empty-premium__ghost" aria-hidden="true">
              {[85, 65].map((w, i) => (
                <div key={i} className="pf-positions-empty-premium__ghost-card" style={{ opacity: 0.12 - i * 0.04 }}>
                  <div className="pf-positions-empty-premium__ghost-line" style={{ width: `${w}%` }} />
                  <div className="pf-positions-empty-premium__ghost-line pf-positions-empty-premium__ghost-line--sm" />
                </div>
              ))}
            </div>
            <Link
              href="/vaults"
              className="pf-positions-empty-premium__cta group"
            >
              <span className="flex flex-col min-w-0">
                <span className="text-[length:var(--ct-text-sm)] font-semibold text-secondary tracking-tight group-hover:text-accent transition-colors">Explore Opportunities</span>
                <span className="text-[length:var(--ct-text-2xs)] text-tertiary opacity-70 mt-[var(--ct-space-0_5)]">Subscribe to your first vault position</span>
              </span>
              <span className="flex items-center justify-center w-[var(--ct-space-8)] h-[var(--ct-space-8)] rounded-full bg-[color-mix(in_srgb,var(--ct-surface-1)_60%,transparent)] border border-[color-mix(in_srgb,var(--ct-border-soft)_20%,transparent)] text-secondary group-hover:text-accent group-hover:border-[color-mix(in_srgb,var(--ct-accent)_25%,transparent)] transition-all flex-shrink-0">
                <Plus size={15} strokeWidth={2.5} aria-hidden="true" />
              </span>
            </Link>
          </div>
        )}

        {hasPositions && leafHref && (
          <Link href={leafHref} className="group flex items-center justify-center gap-[var(--ct-space-2)] p-[var(--ct-space-2_5)] mt-[var(--ct-space-1)] rounded-lg border border-[color-mix(in_srgb,var(--ct-border-soft)_12%,transparent)] hover:border-[color-mix(in_srgb,var(--ct-accent)_15%,transparent)] hover:bg-[color-mix(in_srgb,var(--ct-surface-1)_40%,transparent)] transition-all">
            <span className="text-[length:var(--ct-text-micro)] uppercase tracking-wider font-semibold text-tertiary group-hover:text-secondary transition-colors">View all positions</span>
            <ChevronRight size={13} className="text-tertiary group-hover:text-secondary transition-colors" />
          </Link>
        )}
      </div>
    </PfCockpitPanel>
  );
}
