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
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-[0.08em] uppercase ring-1",
        isLive
          ? "text-(--ct-accent-strong) ring-(--ct-border-accent)"
          : "text-zinc-500 ring-zinc-950/10 dark:text-zinc-400 dark:ring-white/10",
      )}
    >
      {isLive ? <span className="size-1.5 rounded-full bg-(--ct-accent)" /> : null}
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
      className={cn(
        "flex h-full min-h-72 flex-col overflow-hidden rounded-xl bg-white ring-1 ring-zinc-950/[0.08] dark:bg-zinc-950/40 dark:ring-white/10",
        className,
      )}
    >
      <Series1PanelHeader title={title} description={description} actions={<Series1ProvenanceTag status={status} />} />
      {/* Chart well: recessed below the panel fill, with hairline ghost
          gridlines so an empty state reads as a plotting surface waiting for a
          series rather than blank card padding. Chrome only — never data. */}
      <div className="s1-chart-well flex min-h-0 flex-1 flex-col items-center justify-center gap-1 bg-zinc-50 px-6 py-8 text-center dark:bg-black/20">
        <p className="text-sm font-medium text-zinc-950 dark:text-white">{label}</p>
        <p className="max-w-sm text-xs leading-5 text-zinc-500 dark:text-zinc-400">{detail}</p>
      </div>
    </figure>
  );
}
