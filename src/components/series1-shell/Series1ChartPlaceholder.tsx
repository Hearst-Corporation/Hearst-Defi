import type { ReactNode } from "react";

import { BentoBadge } from "@/components/catalyst/bento-badge";
import { cn } from "@/lib/cn";

import { Series1PanelHeader } from "./Series1Panel";

export type Series1Provenance = "live" | "mock" | "stale" | "configured" | "attested" | "unavailable";

const PROVENANCE_LABEL: Record<Series1Provenance, string> = {
  live: "Live",
  mock: "Placeholder",
  stale: "Stale",
  configured: "Not configured",
  attested: "Attested",
  unavailable: "Unavailable",
};

export function Series1ProvenanceTag({ status }: { status: Series1Provenance }) {
  const isLive = status === "live";
  return (
    // Catalyst is the primitive; `flat` strips the bento border/fill/tracking so
    // the delegated chip carries this tag's exact chrome — a ring pill, live-vs-
    // idle tone, dot on live only. className (after) restores the geometry and
    // tokens verbatim; rendering is unchanged.
    <BentoBadge
      variant="flat"
      className={cn(
        "items-center gap-1.5 rounded-full border-0 px-2.5 py-1 text-[length:var(--ct-text-deci)] font-semibold uppercase tracking-[0.08em] leading-normal whitespace-normal ring-1",
        isLive
          ? "text-(--ct-accent-strong) ring-(--ct-border-accent)"
          : "text-(--ct-text-muted) ring-(--ct-border-soft)",
      )}
    >
      {isLive ? <span className="size-1.5 rounded-full bg-(--ct-accent)" /> : null}
      {PROVENANCE_LABEL[status]}
    </BentoBadge>
  );
}

/**
 * Placeholder chart surface — used everywhere a real time series is not
 * required for this pass. Always labeled, never dressed as a live chart.
 */
export function Series1ChartPlaceholder({
  title,
  description,
  status = "mock",
  label,
  detail,
  className,
}: {
  title: string;
  description?: ReactNode;
  status?: Series1Provenance;
  label: string;
  detail: string;
  className?: string;
}) {
  return (
    <figure
      className={cn(
        "flex h-full min-h-72 flex-col overflow-hidden rounded-(--ct-radius-xl) border border-(--ct-border-soft)",
        className,
      )}
    >
      <Series1PanelHeader title={title} description={description} actions={<Series1ProvenanceTag status={status} />} />
      {/* Chart well: recessed below the panel fill, with hairline ghost
          gridlines so an empty state reads as a plotting surface waiting for a
          series rather than blank card padding. Chrome only — never data. */}
      <div className="s1-chart-well flex min-h-0 flex-1 flex-col items-center justify-center gap-1 bg-[color-mix(in_srgb,var(--ct-bg-deep)_90%,var(--ct-surface-page))] px-6 py-8 text-center">
        <p className="text-sm font-medium text-(--ct-text-strong)">{label}</p>
        <p className="max-w-sm text-xs leading-5 text-(--ct-text-muted)">{detail}</p>
      </div>
    </figure>
  );
}
