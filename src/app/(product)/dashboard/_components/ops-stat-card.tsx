// OpsStatCard — the uniform Zone 3 gabarit. Every operational card on the
// dashboard row shares this exact skeleton so the row reads as ONE band:
//
//   header   : label + provenance badge          (fixed line)
//   value    : one dominant figure + qualifier   (fixed line)
//   detail   : one supporting line               (fixed line)
//   media    : optional slot (progress, bars…)   (flex-grows, keeps baseline)
//   footer   : link + optional right meta        (pinned bottom)
//
// Equal density = visual balance. No card carries its own layout.

import { Card } from "@/components/catalyst/card";
import { ProvenanceBadge, type Provenance } from "@/components/ui/provenance-badge";
import Link from "next/link";

export interface OpsStatCardProps {
  label: string;
  icon?: React.ReactNode;
  provenance: Provenance;
  /** Dominant figure line — value + optional unit/qualifier, pre-styled. */
  value: React.ReactNode;
  /** One supporting line under the value. */
  detail: React.ReactNode;
  /** Optional media slot (progress bar, micro chart) — keeps cards level. */
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
  return (
    <Card className="w-full h-full flex flex-col p-[var(--ct-space-5)] gap-[var(--ct-space-3)]">
      <div className="flex items-center justify-between gap-[var(--ct-space-2)]">
        <span className="flex items-center gap-[var(--ct-space-2)] min-w-0">
          {icon}
          <span className="ct-bento-label truncate">{label}</span>
        </span>
        <ProvenanceBadge kind={provenance} variant="compact" />
      </div>

      <div className="flex flex-col gap-[var(--ct-space-1)] min-w-0">
        <div className="leading-none">{value}</div>
        <div className="body-xs ct-text-muted truncate">{detail}</div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col justify-end">{media ?? null}</div>

      <div className="pt-[var(--ct-space-3)] border-t border-[var(--ct-border-soft)] flex items-center justify-between gap-[var(--ct-space-2)]">
        <Link
          href={footerHref}
          className="body-xs ct-link-accent whitespace-nowrap focus-visible:outline-none ct-focus-ring rounded-sm"
        >
          {footerLabel}
        </Link>
        {footerMeta ? <span className="ct-metric-caption truncate">{footerMeta}</span> : null}
      </div>
    </Card>
  );
}
