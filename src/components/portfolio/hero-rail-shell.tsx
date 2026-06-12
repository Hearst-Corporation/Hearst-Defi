import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export function HeroRailGroup({
  title,
  "aria-label": ariaLabel,
  payout,
  children,
}: {
  title: string;
  "aria-label": string;
  /** Payout block uses a larger primary value line. */
  payout?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className={cn("pf-hero-rail-group", payout && "pf-hero-rail-group--payout")}
      aria-label={ariaLabel}
    >
      <p className="pf-hero-rail-title">{title}</p>
      {children}
    </section>
  );
}
