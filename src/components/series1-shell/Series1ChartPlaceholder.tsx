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
        borderColor: "var(--s1-line)",
        color: isLive ? "var(--s1-accent)" : "var(--s1-muted)",
        background: isLive ? "var(--s1-accent-soft)" : "var(--s1-panel-soft)",
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
    <figure className={cn("flex h-full min-h-72 flex-col overflow-hidden rounded-[var(--s1-radius)] border", className)} style={{ background: "var(--s1-panel)", borderColor: "var(--s1-line)", boxShadow: "var(--s1-shadow)" }}>
      <Series1PanelHeader title={title} description={description} actions={<Series1ProvenanceTag status={status} />} />
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1 px-6 py-8 text-center">
        <p className="text-sm font-medium">{label}</p>
        <p className="max-w-sm text-xs leading-5" style={{ color: "var(--s1-muted)" }}>
          {detail}
        </p>
      </div>
    </figure>
  );
}
