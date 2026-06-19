import type { ReactNode } from "react";

import {
  ProvenanceBadge,
  type Provenance,
} from "@/components/ui/provenance-badge";
import { cn } from "@/lib/cn";

/**
 * Hero KPI rail group — one compact stat block in the hero sidebar.
 * Recoded: a tight title row (micro uppercase + optional provenance dot) over
 * the group body. Three of these stack in the sidebar (metrics · payout ·
 * liquidity), evenly distributed so nothing clips in the no-scroll hero.
 */
export function HeroRailGroup({
  title,
  "aria-label": ariaLabel,
  payout,
  slot,
  provenance,
  children,
}: {
  title: string;
  "aria-label": string;
  /** Payout block uses a larger primary value line. */
  payout?: boolean;
  /** Stable hook for layout-specific CSS without relying on DOM order. */
  slot?: "metrics";
  provenance?: Provenance;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        "pf-hero-rail-group",
        payout && "pf-hero-rail-group--payout",
        slot && `pf-hero-rail-group--${slot}`,
      )}
      aria-label={ariaLabel}
    >
      <div className="pf-hero-rail-head">
        <p className="pf-hero-rail-title m-0">{title}</p>
        {provenance ? (
          <ProvenanceBadge kind={provenance} variant="strip" compact />
        ) : null}
      </div>
      {children}
    </section>
  );
}
