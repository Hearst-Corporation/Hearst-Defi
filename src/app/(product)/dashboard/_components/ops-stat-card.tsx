// OpsStatCard — the uniform Zone 3 gabarit. Every operational card on the
// dashboard + /btc rows shares this exact skeleton so the row reads as ONE
// band:
//
//   header   : md icon + label                        (fixed line)
//   value    : one dominant figure                    (fixed line)
//   detail   : one supporting sentence                (fixed line)
//   media    : optional slot, FIXED height h-5        (keeps rows level)
//   footer   : meta left · "View …" link RIGHT        (pinned bottom)
//
// Equal density + identical spacing scale (--ct-space-*) = pixel alignment
// across the row: value baselines, media slots, and footers all land on the
// same y. Hierarchy pass 2026-07-16: bigger icon (md), link moved right.

import { Card } from "@/components/catalyst/card";
import { ProvenanceBadge, type Provenance } from "@/components/catalyst/provenance-badge";
import Link from "next/link";

export interface OpsStatCardProps {
  label: string;
  icon?: React.ReactNode;
  /** Optional — omit when the page-level badge already covers the block
   *  (noise-reduction pass 2026-07-16: one badge per page, not per card). */
  provenance?: Provenance;
  /** Dominant figure line — value + optional unit/qualifier, pre-styled. */
  value: React.ReactNode;
  /** One supporting line under the value. */
  detail: React.ReactNode;
  /** Optional media slot (progress bar, micro stat) — fixed-height so cards
   *  without one stay level with cards that have one. */
  media?: React.ReactNode;
  footerHref: string;
  footerLabel: string;
  footerMeta?: React.ReactNode;
}

export function OpsStatCard({
  label,
  icon,
  provenance,
  value,
  detail,
  media,
  footerHref,
  footerLabel,
  footerMeta,
}: OpsStatCardProps) {
  // A11y (P1.8): callers historically embed a trailing "→" in footerLabel.
  // Strip it from the accessible text and re-render it as a decorative,
  // aria-hidden glyph so screen readers never announce a raw arrow.
  const footerText = footerLabel.replace(/\s*(?:→|->)\s*$/u, "");
  return (
    <Card className="w-full h-full flex flex-col p-[var(--ct-space-5)] gap-[var(--ct-space-3)]">
      {/* Header — md icon gives the card its identity at a glance */}
      <div className="flex items-center justify-between gap-[var(--ct-space-2)]">
        <span className="flex items-center gap-[var(--ct-space-2_5)] min-w-0">
          {icon}
          <span className="ct-bento-label truncate">{label}</span>
        </span>
        {provenance ? <ProvenanceBadge kind={provenance} variant="compact" /> : null}
      </div>

      {/* Value → detail — one dominant figure, one supporting sentence */}
      <div className="flex flex-col gap-[var(--ct-space-1_5)] min-w-0">
        <div className="leading-none">{value}</div>
        <div className="body-xs ct-text-muted truncate">{detail}</div>
      </div>

      {/* Bottom group — pinned to the card floor (mt-auto). The optional media
          block sits DIRECTLY above the footer rule so the hairline never floats
          in the empty middle of a tall card ("ligne trop haute" fix). The
          footer is the last line of every card, so its rule lands on the same y
          across the row whether or not a card carries a media block. */}
      <div className="mt-auto flex flex-col gap-[var(--ct-space-3)]">
        {media ? (
          <div className="min-h-5 flex flex-col justify-center">{media}</div>
        ) : null}

        {/* Footer — meta left, "View …" action RIGHT (hierarchy pass).
            Caption idiom unified with the detail line (body-xs muted, P0.6). */}
        <div className="pt-[var(--ct-space-3)] border-t border-[var(--ct-border-soft)] flex items-center justify-between gap-[var(--ct-space-2)]">
          {footerMeta ? (
            <span className="body-xs ct-text-muted truncate">{footerMeta}</span>
          ) : (
            <span aria-hidden />
          )}
          <Link
            href={footerHref}
            className="body-xs ct-link-accent whitespace-nowrap focus-visible:outline-none ct-focus-ring rounded-sm"
          >
            {footerText}
            <span aria-hidden="true"> →</span>
            <span className="sr-only"> (View {label} details)</span>
          </Link>
        </div>
      </div>
    </Card>
  );
}
