// AdminDashboardHero — the operator's dominant read.
//
// Hero variant: elevated surface, accent hairline, no nested heavy card chrome.

import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import type { OperatingTone } from "@/lib/admin/dashboard-operating-view";
import {
  surfaceClassName,
  surfaceHeroAccentLine,
} from "@/lib/ui/surface-classes";

const TONE_DOT: Record<OperatingTone, string> = {
  ok: "bg-[var(--ct-accent)]",
  watch: "bg-[var(--ct-status-warning)]",
  alert: "bg-[var(--ct-status-danger)]",
  idle: "bg-[var(--ct-text-faint)]",
};

const TONE_TEXT: Record<OperatingTone, string> = {
  ok: "text-[var(--ct-accent-strong)]",
  watch: "text-[var(--ct-status-warning)]",
  alert: "text-[var(--ct-status-danger)]",
  idle: "text-[var(--ct-text-faint)]",
};

export function AdminDashboardHero({
  posture,
  postureLabel,
  blurb,
  contractLabel,
  pendingCount,
  trailing,
}: {
  posture: OperatingTone;
  postureLabel: string;
  blurb: string;
  contractLabel: string;
  pendingCount: number;
  trailing?: ReactNode;
}) {
  return (
    <section className={surfaceClassName("hero")} aria-label="Operating posture">
      <div className={surfaceHeroAccentLine} />

      <div className="flex flex-col gap-[var(--ct-space-5)] p-[var(--ct-space-6)] lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p
            className="m-0 font-semibold uppercase tracking-[0.14em] text-[var(--ct-text-faint)]"
            style={{ fontSize: "var(--ct-text-deci)" }}
          >
            Hearst operations · Series 1
          </p>

          <div className="mt-[var(--ct-space-4)] flex items-center gap-[var(--ct-space-3)]">
            <span
              aria-hidden
              className={cn("size-3 shrink-0 rounded-full", TONE_DOT[posture])}
            />
            <h1
              className={cn(
                "m-0 font-semibold tracking-tight",
                TONE_TEXT[posture],
              )}
              style={{ fontSize: "var(--ct-text-hero)", lineHeight: 1.05 }}
            >
              {postureLabel}
            </h1>
          </div>

          <p
            className="m-0 mt-[var(--ct-space-3)] max-w-[76ch] leading-relaxed text-[var(--ct-text-muted)]"
            style={{ fontSize: "var(--ct-text-xs)" }}
          >
            {blurb}
          </p>
        </div>

        {trailing ? <div className="shrink-0">{trailing}</div> : null}
      </div>

      <div className="flex flex-col border-t border-[var(--ct-border-soft)] bg-[color-mix(in_srgb,var(--ct-bg-deep)_90%,var(--ct-surface-page))] sm:flex-row">
        <div className="min-w-0 flex-1 px-[var(--ct-space-5)] py-[var(--ct-space-4)]">
          <p
            className="m-0 text-[var(--ct-text-faint)]"
            style={{ fontSize: "var(--ct-text-nano)" }}
          >
            Contract
          </p>
          <p
            className="m-0 mt-[var(--ct-space-1)] truncate font-semibold text-[var(--ct-text-strong)]"
            style={{ fontSize: "var(--ct-text-xl-fixed)" }}
          >
            {contractLabel}
          </p>
        </div>
        <div className="min-w-0 flex-1 border-t border-[var(--ct-border-soft)] px-[var(--ct-space-5)] py-[var(--ct-space-4)] sm:border-t-0 sm:border-l">
          <p
            className="m-0 text-[var(--ct-text-faint)]"
            style={{ fontSize: "var(--ct-text-nano)" }}
          >
            Awaiting an operator
          </p>
          <p
            className={cn(
              "m-0 mt-[var(--ct-space-1)] font-semibold tabular-nums",
              pendingCount > 0
                ? "text-[var(--ct-accent-strong)]"
                : "text-[var(--ct-text-strong)]",
            )}
            style={{ fontSize: "var(--ct-text-xl-fixed)" }}
          >
            {pendingCount === 0 ? "Nothing pending" : String(pendingCount)}
          </p>
        </div>
      </div>
    </section>
  );
}
