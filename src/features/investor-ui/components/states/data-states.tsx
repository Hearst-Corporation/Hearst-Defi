// src/features/investor-ui/components/states/data-states.tsx
//
// Shared per-block state renderers for the Investor UI V2 refonte. Every
// screen composes several `ResolvedViewModel<T>` blocks (see
// `types/common.ts`); these components render the honest, non-LIVE statuses
// so no page hand-rolls its own "no data" copy. Token-only, delegates chrome
// to the existing Catalyst primitives (`EmptySurface`, `PanelStatus`,
// `Skeleton`) — this file adds NO new visual language, only a per-status
// dispatch on top of what already exists.
//
// STUB — created by A2 (Dashboard) because A5's `components/states/*` had not
// landed yet at the time this page was built. Same expected file path/shape
// A5 targets; if A5 lands its own version, fold/merge — component names below
// are the contract other screens should import.

import type { ReactNode } from "react";

import { EmptySurface } from "@/components/catalyst/empty-surface";
import { PanelStatus } from "@/components/catalyst/panel-status";
import { Skeleton } from "@/components/catalyst/skeleton";
import { cn } from "@/lib/cn";

/** A block's contract read failed / the source answered with nothing. */
export function DataUnavailable({
  label,
  detail,
  className,
}: {
  label: string;
  detail?: string;
  className?: string;
}) {
  return (
    <EmptySurface
      variant="widget"
      message={`${label} unavailable`}
      detail={detail ?? "The data source did not resolve. Nothing is being estimated in its place."}
      className={className}
    />
  );
}

/** A block resolved, but its data is old enough to flag explicitly. */
export function DataStale({
  label,
  freshness,
  children,
  className,
}: {
  label: string;
  freshness?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-[var(--ct-space-2)]", className)}>
      {children}
      <PanelStatus
        tone="muted"
        message={`${label} — stale`}
        detail={freshness ?? "Awaiting a fresher read from the source."}
      />
    </div>
  );
}

/** The underlying contract/feature is not deployed/enabled yet — expected, not an error. */
export function DataNotConfigured({
  label,
  detail,
  className,
}: {
  label: string;
  detail?: string;
  className?: string;
}) {
  return (
    <EmptySurface
      variant="widget"
      message={`${label} not configured`}
      detail={detail ?? "This reads from a contract that is not deployed on this network yet."}
      className={className}
    />
  );
}

/** Some of the block resolved, some didn't — render what's real, flag the rest. */
export function DataPartial({
  label,
  detail,
  children,
  className,
}: {
  label: string;
  detail?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-[var(--ct-space-2)]", className)}>
      {children}
      <PanelStatus
        tone="muted"
        message={`${label} — partial`}
        detail={detail ?? "Some fields have not resolved yet."}
      />
    </div>
  );
}

/** Page-level (not block-level) hard failure — the data source itself threw. */
export function PageErrorState({
  title = "Something went wrong loading this page",
  detail = "Try reloading. If this keeps happening, the issue has been logged.",
  className,
}: {
  title?: string;
  detail?: string;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "ct-card ct-glass-panel flex flex-col items-start gap-[var(--ct-space-2)] p-[var(--ct-space-6)]",
        className,
      )}
    >
      <h2 className="h3 ct-text-strong m-0">{title}</h2>
      <p className="body-sm ct-text-muted m-0">{detail}</p>
    </div>
  );
}

/** Page-level loading skeleton — generic block-shaped placeholders. */
export function PageSkeleton({
  rows = 4,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-[var(--ct-space-4)]", className)} aria-busy="true" aria-label="Loading">
      <Skeleton className="h-32 w-full rounded-2xl" />
      <div className="grid grid-cols-1 gap-[var(--ct-space-4)] md:grid-cols-3">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}
