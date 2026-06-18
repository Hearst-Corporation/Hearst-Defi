import type { ReactNode } from "react";

import {
  ProvenanceBadge,
  type Provenance,
} from "@/components/ui/provenance-badge";
import { cn } from "@/lib/cn";

export function HeroRailGroup({
  title,
  "aria-label": ariaLabel,
  payout,
  provenance,
  children,
}: {
  title: string;
  "aria-label": string;
  /** Payout block uses a larger primary value line. */
  payout?: boolean;
  provenance?: Provenance;
  children: ReactNode;
}) {
  return (
    <section
      className={cn("pf-hero-rail-group", payout && "pf-hero-rail-group--payout")}
      aria-label={ariaLabel}
    >
      <div className="pf-inline-row pf-inline-row--between pf-inline-row--baseline">
        <p className="pf-hero-rail-title m-0">{title}</p>
        {provenance ? (
          <ProvenanceBadge kind={provenance} variant="strip" compact />
        ) : null}
      </div>
      {children}
    </section>
  );
}
