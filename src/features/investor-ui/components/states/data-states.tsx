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

import Link from "next/link";

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

/** Honest page-error mode → its human label. No fabricated status, no Live/Verified. */
const PAGE_ERROR_MODE_LABEL: Record<PageErrorMode, string> = {
  backend_down: "backend down",
  source_pending: "source pending",
};

export type PageErrorMode = "backend_down" | "source_pending";

/** Page-level (not block-level) hard failure — the data source itself threw. */
export function PageErrorState({
  title = "Something went wrong loading this page",
  detail = "Try reloading. If this keeps happening, the issue has been logged.",
  requestId,
  mode,
  cta,
  className,
}: {
  title?: string;
  detail?: string;
  requestId?: string;
  mode?: PageErrorMode;
  cta?: { label: string; href: string };
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
      {mode ? (
        <span
          data-testid="page-error-mode"
          className="body-xs ct-text-muted inline-flex items-center rounded-full border border-[var(--ct-border)] bg-[var(--ct-surface-inset)] px-[var(--ct-space-2)] py-[var(--ct-space-1)]"
        >
          {PAGE_ERROR_MODE_LABEL[mode]}
        </span>
      ) : null}
      <h2 className="h3 ct-text-strong m-0">{title}</h2>
      <p className="body-sm ct-text-muted m-0">{detail}</p>
      {requestId ? (
        <p
          data-testid="page-error-request-id"
          className="body-xs ct-text-faint m-0 tabular-nums"
        >
          request {requestId}
        </p>
      ) : null}
      {cta ? (
        <Link
          href={cta.href}
          data-testid="page-error-cta"
          className="body-xs ct-text-muted underline underline-offset-2 decoration-[var(--ct-border)] mt-[var(--ct-space-1)]"
        >
          {cta.label}
        </Link>
      ) : null}
    </div>
  );
}

/**
 * Backend source of truth is unreachable — the app cannot read live/attested
 * data from the backend. Honest composition of `PageErrorState`: no fabricated
 * data, no Live/Verified badge, CTA is an internal anchor (no network action).
 */
export function BackendDownState({
  requestId,
  path,
  mode = "backend_down",
  className,
}: {
  requestId?: string;
  path: string;
  mode?: PageErrorMode;
  className?: string;
}) {
  return (
    <PageErrorState
      title="Backend source of truth unavailable"
      detail={`${path} unreachable`}
      mode={mode}
      requestId={requestId}
      cta={{ label: "Check BACKEND_URL", href: "#backend-config" }}
      className={className}
    />
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
