import type { ReactNode } from "react";

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
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-[0.08em] uppercase"
      style={{
        // Live keeps the accent on its edge, dot and text; the fill stays the
        // neutral chip so a green pill never competes with the data it labels.
        borderColor: isLive ? "var(--s1-accent-line)" : "var(--s1-line-strong)",
        color: isLive ? "var(--s1-accent)" : "var(--s1-muted)",
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0)), var(--s1-panel-soft)",
        boxShadow: isLive
          ? "inset 0 1px 0 var(--s1-highlight), 0 0 10px -3px rgba(167,251,144,0.3)"
          : "inset 0 1px 0 var(--s1-highlight)",
      }}
    >
      {isLive ? <span className="size-1.5 rounded-full" style={{ background: "var(--s1-accent)" }} /> : null}
      {PROVENANCE_LABEL[status]}
    </span>
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
      className={cn("flex h-full min-h-72 flex-col overflow-hidden rounded-[var(--s1-radius)] border", className)}
      style={{
        background:
          "linear-gradient(150deg, rgba(255,255,255,0.028), rgba(255,255,255,0) 18rem), var(--s1-panel)",
        borderColor: "var(--s1-line-strong)",
        boxShadow: "var(--s1-shadow-panel)",
      }}
    >
      <Series1PanelHeader title={title} description={description} actions={<Series1ProvenanceTag status={status} />} />
      {/* Chart well: recessed below the panel fill so an empty state reads as
          a plotting surface waiting for a series, not as blank card padding.
          Ghost gridlines give the well the geometry of a plot area — they are
          pure chrome at hairline opacity and never imply a data series. */}
      <div
        className="relative flex min-h-0 flex-1 flex-col items-center justify-center gap-1 px-6 py-8 text-center"
        style={{
          background:
            "repeating-linear-gradient(180deg, rgba(231,240,227,0.045) 0 1px, rgba(255,255,255,0) 1px 25%), repeating-linear-gradient(90deg, rgba(231,240,227,0.028) 0 1px, rgba(255,255,255,0) 1px 16.66%), var(--s1-inset)",
          boxShadow: "var(--s1-shadow-inset)",
        }}
      >
        <p className="text-sm font-medium">{label}</p>
        <p className="max-w-sm text-xs leading-5" style={{ color: "var(--s1-muted)" }}>
          {detail}
        </p>
      </div>
    </figure>
  );
}
