import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/cn";

type TileHref = ComponentProps<typeof Link>["href"];

/**
 * A "view more" teaser tile on the no-scroll portfolio dashboard. Surfaces a
 * single honest summary figure + a link to the dedicated leaf page that holds
 * the full block. The PAGE computes the honest content (calm copy at zero,
 * never fabricated values) — this tile is presentational only.
 */
export function PortfolioTeaserTile({
  href,
  label,
  value,
  meta,
  moreLabel,
}: {
  href: TileHref;
  label: string;
  value: ReactNode;
  meta?: ReactNode;
  moreLabel: string;
}) {
  return (
    <Link href={href} className={cn("pf-cockpit-panel", "pf-teaser")}>
      <div className="pf-teaser__head">
        <span className="pf-panel-title">{label}</span>
        <span className="pf-teaser__more">{moreLabel} →</span>
      </div>
      <div className="pf-teaser__body">
        <span className="pf-teaser__value">{value}</span>
        {meta != null ? <span className="pf-teaser__meta">{meta}</span> : null}
      </div>
    </Link>
  );
}
