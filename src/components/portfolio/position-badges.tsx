import Link from "next/link";
import { ApyRange } from "@/components/ui/apy-range";
import { type PortfolioPosition, POSITION_STATUS_CONFIG } from "@/lib/data/portfolio";
import { formatUsdCompact } from "@/lib/vaults/product-display";
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
 * PositionCards — Premium position card stack.
 * Structured grid layout: vault name · status · position value · APY · chevron.
 * Green accent only on active badge and APY — not decorative.
 */
export function PositionCards({
  positions,
  leafHref,
  embedded = false,
}: PositionCardsProps) {
  const hasPositions = positions.length > 0;
  const openedFmt = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

  return (
    <PfCockpitPanel
      variant="wide"
      chrome={embedded ? "embedded" : "panel"}
      aria-label="Your positions"
      className="pf-positions-badges"
    >
      <PfCockpitPanelHeader
        title={hasPositions ? "Positions" : "Vaults"}
        titleVariant="primary"
        trailing={
          hasPositions ? (
            <span className="pf-pos-count-badge">
              {positions.length} active
            </span>
          ) : undefined
        }
      />

      <div className="pf-positions-stack">
        {hasPositions ? (
          <>
            <div className="pf-positions__row pf-positions__row--head" aria-hidden="true">
              <span>Vault</span>
              <span>Opened</span>
              <span>Status</span>
              <span className="text-right">Value</span>
              <span className="text-right">Target APY</span>
            </div>
            {positions.map((p, idx) => {
              const statusConfig = POSITION_STATUS_CONFIG[p.status];
              return (
                <Link
                  key={p.id}
                  href={`/portfolio/${p.id}`}
                  className="pf-positions__row pf-positions__row--body"
                  style={{ animationDelay: `${idx * 0.07}s` }}
                  aria-label={`${p.vaultName ?? "Vault"} — ${statusConfig.label} — ${formatUsdCompact(p.valueUsdc)}`}
                >
                  <span className="pf-positions__vault">
                    <span>{p.vaultName ?? "Vault"}</span>
                  </span>
                  <span className="pf-positions__opened">
                    {openedFmt.format(p.subscribedAt)}
                  </span>
                  <span className="pf-positions__status-cell">
                    <span
                      className={statusConfig.dot}
                      aria-hidden="true"
                    />
                    <span>{statusConfig.label}</span>
                  </span>
                  <span className="pf-positions__num">
                    {formatUsdCompact(p.valueUsdc)}
                  </span>
                  <span className="pf-positions__num">
                    {p.apyLow !== null && p.apyHigh !== null ? (
                      <ApyRange low={p.apyLow} high={p.apyHigh} />
                    ) : (
                      "—"
                    )}
                  </span>
                </Link>
              );
            })}
          </>
        ) : (
          /* Empty state — premium ghost + CTA */
          <div className="pf-positions-empty-premium">
            <div className="pf-positions-empty-premium__ghost" aria-hidden="true">
              {[85, 65].map((w, i) => (
                <div key={i} className="pf-positions-empty-premium__ghost-card" style={{ opacity: 0.10 - i * 0.03 }}>
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
                <span className="pf-positions-empty-cta-label">Explore vaults</span>
                <span className="pf-positions-empty-cta-sub">Subscribe to your first position</span>
              </span>
              <span className="pf-positions-empty-cta-icon">
                <Plus size={15} strokeWidth={2.5} aria-hidden="true" />
              </span>
            </Link>
          </div>
        )}

        {hasPositions && leafHref && (
          <Link href={leafHref} className="pf-positions-view-all group">
            <span className="pf-positions-view-all__label">View all positions</span>
            <ChevronRight size={13} className="pf-positions-view-all__icon" />
          </Link>
        )}
      </div>
    </PfCockpitPanel>
  );
}
