// AdminReadinessPanel — the operator's first read: is the system ready?
//
// This is the REWRITE of `system-readiness.tsx`, and the honesty violations it
// deletes are the reason it is a rewrite and not a restyle (canon F4):
//
//   - `99.98%` uptime was a HARDCODED LITERAL. There is no uptime feed in this
//     app. It is gone; nothing replaces it, because inventing a second number
//     would be the same lie.
//   - "Last scan" rendered `new Date().toLocaleTimeString()`, i.e. the render
//     time of the page, presented as the time of a scan that never ran. Gone.
//   - Every factor dot was tinted from a tone the caller hardcoded. Here a tone
//     is only ever derived from a factor's own resolved status.
//
// What remains is what is actually known: the readiness factors that the pure
// resolver computes from already-loaded data.

import { cn } from "@/lib/cn";
import type {
  OperatingFactor,
  OperatingReadinessView,
  OperatingTone,
} from "@/lib/admin/dashboard-operating-view";

import {
  AdminDashboardCard,
  AdminDashboardCardHeader,
  AdminDashboardInset,
} from "./AdminDashboardSection";

/** Tone → dot fill. Single accent for ok; status tokens otherwise. */
const TONE_DOT: Record<OperatingTone, string> = {
  ok: "bg-[var(--ct-accent)]",
  watch: "bg-[var(--ct-status-warning)]",
  alert: "bg-[var(--ct-status-danger)]",
  idle: "bg-[var(--ct-text-faint)]",
};

/** Tone → text colour. Accent is a signal on a value, never a surface. */
const TONE_TEXT: Record<OperatingTone, string> = {
  ok: "text-[var(--ct-accent-strong)]",
  watch: "text-[var(--ct-status-warning)]",
  alert: "text-[var(--ct-status-danger)]",
  idle: "text-[var(--ct-text-faint)]",
};

export function AdminReadinessPanel({ view }: { view: OperatingReadinessView }) {
  return (
    <AdminDashboardCard variant="primary" ariaLabel="System readiness">
      <AdminDashboardCardHeader
        title="System readiness"
        caption="Derived from the contract mode, proof and custody reads, the operator queue and the audit trail. No synthetic uptime, no synthetic scan time."
      />

      <div className="flex flex-col gap-[var(--ct-space-4)] p-[var(--ct-space-5)]">
        {/* Verdict — the dominant operator read. */}
        <div className="flex items-center gap-[var(--ct-space-3)]">
          <span
            aria-hidden
            className={cn("size-2.5 shrink-0 rounded-full", TONE_DOT[view.posture])}
          />
          <span
            className={cn(
              "font-bold leading-none tracking-tight",
              TONE_TEXT[view.posture],
            )}
            style={{ fontSize: "var(--ct-text-3xl-fixed)" }}
          >
            {view.postureLabel}
          </span>
        </div>

        <p
          className="m-0 max-w-[72ch] leading-relaxed text-[var(--ct-text-muted)]"
          style={{ fontSize: "var(--ct-text-xs)" }}
        >
          {view.postureBlurb}
        </p>
      </div>

      {/* Factors — each dot's tone comes from that factor's own resolved
          status, never from a literal passed in by the caller. */}
      <AdminDashboardInset
        className="flex flex-wrap gap-x-[var(--ct-space-6)] gap-y-[var(--ct-space-3)] border-t border-[var(--ct-border-soft)] px-[var(--ct-space-5)] py-[var(--ct-space-4)]"
        role="list"
      >
        {view.factors.map((factor) => (
          <ReadinessFactorDot key={factor.id} factor={factor} />
        ))}
      </AdminDashboardInset>
    </AdminDashboardCard>
  );
}

function ReadinessFactorDot({ factor }: { factor: OperatingFactor }) {
  return (
    <div
      role="listitem"
      className="inline-flex min-w-0 items-center gap-[var(--ct-space-2)]"
      aria-label={`${factor.label}: ${factor.status}`}
      title={factor.detail}
    >
      <span
        aria-hidden
        className={cn("size-2 shrink-0 rounded-full", TONE_DOT[factor.tone])}
      />
      <span
        className={cn("truncate font-medium", TONE_TEXT[factor.tone])}
        style={{ fontSize: "var(--ct-text-micro)" }}
      >
        {factor.label}
      </span>
    </div>
  );
}
