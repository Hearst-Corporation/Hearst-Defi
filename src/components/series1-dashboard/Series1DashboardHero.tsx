import type { ReactNode } from "react";

import { ChartDonut } from "@/components/catalyst/chart-donut";
import { cn } from "@/lib/cn";
import {
  surfaceClassName,
  surfaceHeroAccentLine,
} from "@/lib/ui/surface-classes";

export interface Series1HeroContext {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  /** True when the underlying read did not resolve — renders quiet. */
  muted?: boolean;
}

/**
 * One allocation pocket for the hero composition ring. The values are a POLICY
 * target — a spec constant (VAULT_SPEC v2.1 §6), never a measurement — so the
 * ring here is always honest: it plots the configured split, not an on-chain
 * read that may be absent. The ring normalizes for display only; it never
 * invents a business total.
 */
export interface Series1HeroAllocation {
  id: string;
  label: string;
  value: number;
}

export function Series1DashboardHero({
  eyebrow,
  label,
  value,
  muted = false,
  caption,
  context,
  trailing,
  allocation,
}: {
  /** Product line, e.g. "Hearst Bitcoin Reserve Vault · Series 1". */
  eyebrow: string;
  /** What the hero number IS, e.g. "Bitcoin accumulated". */
  label: string;
  value: ReactNode;
  muted?: boolean;
  /** One-line honest framing under the number. */
  caption: ReactNode;
  /** The secondary KPI cells welded to the right of the hero. */
  context: readonly Series1HeroContext[];
  /** Provenance slot, rendered under the hero caption. */
  trailing?: ReactNode;
  /**
   * Optional policy-allocation split. When provided, a composition ring is
   * welded beside the hero number, filling the left column with honest
   * data-viz. Absent → the hero renders exactly as before (retro-compatible).
   */
  allocation?: readonly Series1HeroAllocation[];
}) {
  const hasAllocation = !muted && Array.isArray(allocation) && allocation.length > 0;

  return (
    <section className={surfaceClassName("hero")}>
      <div className={surfaceHeroAccentLine} />
      <div className="px-(--ct-space-6) pt-(--ct-space-6) pb-(--ct-space-4)">
        <p
          className="m-0 font-semibold uppercase tracking-[0.12em] text-(--ct-accent-strong)"
          style={{ fontSize: "var(--ct-text-2xs)" }}
        >
          {eyebrow}
        </p>
      </div>

      <div className="grid w-full min-w-0 gap-0 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="flex min-h-[15.5rem] min-w-0 flex-col justify-center gap-(--ct-space-6) border-b border-(--ct-border-soft) px-(--ct-space-6) pb-(--ct-space-6) lg:border-b-0 lg:border-r">
          {/* Hero figure + optional allocation ring, welded on one baseline.
              The ring sits to the RIGHT of the number on wide viewports and
              drops below it when the column narrows — the number always leads
              the reading order, the ring is the supporting composition. */}
          <div className="flex min-w-0 flex-col gap-(--ct-space-6) sm:flex-row sm:items-center sm:gap-(--ct-space-7)">
            <div className="min-w-0 sm:flex-1">
              <p
                className="m-0 flex items-center gap-(--ct-space-2) font-medium text-(--ct-text-muted)"
                style={{ fontSize: "var(--ct-text-2xs)" }}
              >
                <span
                  aria-hidden
                  className="inline-block size-1.5 shrink-0 rounded-full bg-(--ct-accent)"
                />
                {label}
              </p>
              {muted ? (
                <p
                  className="m-0 mt-(--ct-space-3) inline-flex items-center gap-(--ct-space-2) rounded-(--ct-radius-sm) border border-(--ct-border-accent) bg-[color-mix(in_srgb,var(--ct-accent)_8%,transparent)] px-(--ct-space-3) py-(--ct-space-1) font-semibold text-(--ct-text-muted)"
                  style={{ fontSize: "var(--ct-text-xs)" }}
                >
                  <span aria-hidden className="inline-block size-1 rounded-full bg-(--ct-accent)" />
                  Not yet reported
                </p>
              ) : (
                <div
                  className="mt-(--ct-space-3) font-semibold tracking-tight tabular-nums text-(--ct-text-strong)"
                  style={{ fontSize: "var(--ct-text-hero)", lineHeight: 1 }}
                >
                  {value}
                </div>
              )}
            </div>

            {hasAllocation ? (
              <div className="min-w-0 shrink-0 sm:w-[13.5rem]">
                {/* A hairline lead-in so the ring reads as its own instrument,
                    not a stray graphic floating beside the number. */}
                <p
                  className="m-0 mb-(--ct-space-3) flex items-center gap-(--ct-space-2) font-medium uppercase tracking-[0.12em] text-(--ct-text-faint)"
                  style={{ fontSize: "var(--ct-text-nano)" }}
                >
                  Policy allocation
                  <span
                    aria-hidden
                    className="h-px min-w-0 flex-1 bg-(--ct-border-soft)"
                  />
                </p>
                <ChartDonut
                  segments={allocation!.map((p) => ({
                    label: `${p.id} · ${p.label}`,
                    value: p.value,
                  }))}
                  size={128}
                  palette="categorical"
                  bars
                  aria-label="Policy target allocation across the three Series 1 pockets"
                />
                <p
                  className="m-0 mt-(--ct-space-2) text-(--ct-text-faint)"
                  style={{ fontSize: "var(--ct-text-nano)" }}
                >
                  VAULT_SPEC v2.1 §6 — configured target, not a measurement
                </p>
              </div>
            ) : null}
          </div>

          <div className="mt-(--ct-space-4) min-w-0">
            <p
              className="m-0 max-w-[56ch] leading-relaxed text-(--ct-text-muted)"
              style={{ fontSize: "var(--ct-text-2xs)" }}
            >
              {caption}
            </p>
            {trailing ? (
              <div className="mt-(--ct-space-2) min-w-0 overflow-hidden [&_span]:max-w-full [&_span]:flex-wrap">
                {trailing}
              </div>
            ) : null}
          </div>
        </div>
        {/* NOT delegated to Metric variant="nested". The nested variant paints
            its value with .stat-value (32px / extrabold / --ct-accent GREEN)
            and its label with .stat-label (11px / bold / uppercase). These
            welded context cells are value=20px-fixed / semibold, label=2xs /
            medium, and — decisively — the value COLOUR is data-driven: strong
            when resolved, --ct-text-faint when the read is muted. .stat-value
            is always accent-green with no muted branch, so the honest
            resolved/unresolved colour signal cannot be expressed. Delegating
            would resize every value, repaint them green, and destroy the muted
            cue. Rendu stable PRIME : cells left exactly as they are. */}
        <div className="grid h-full min-w-0 auto-rows-fr grid-cols-1 content-stretch gap-0 sm:grid-cols-2">
          {context.map((item, index) => {
            // Dividers derived explicitly from the index against a known
            // 2-column grid — no fragile odd:/nth-[] chaining that silently
            // breaks when the cell count changes.
            //   stacked (1 col): every cell after the first gets a top border.
            //   sm (2 cols): the first ROW (index 0 & 1) has no top border;
            //     every later row does; the left cell of each pair (even index)
            //     gets a right border.
            const isFirstStackedRow = index === 0;
            const isFirstGridRow = index < 2;
            const isLeftColumn = index % 2 === 0;
            return (
              <div
                key={item.label}
                className={cn(
                  "flex min-w-0 flex-col justify-center gap-(--ct-space-1) px-(--ct-space-4) py-(--ct-space-4)",
                  // Stacked baseline: top border on all but the first cell.
                  !isFirstStackedRow && "border-t border-(--ct-border-soft)",
                  // Two-column override: neutralise the top border on the
                  // first grid row (index 1 would otherwise carry it).
                  isFirstGridRow && "sm:border-t-0",
                  isLeftColumn && "sm:border-r sm:border-(--ct-border-soft)",
                )}
              >
                <p
                  className="m-0 font-medium text-(--ct-text-muted)"
                  style={{ fontSize: "var(--ct-text-2xs)" }}
                >
                  {item.label}
                </p>
                <p
                  className={cn(
                    "m-0 truncate font-semibold tracking-tight tabular-nums",
                    item.muted
                      ? "text-(--ct-text-faint)"
                      : "text-(--ct-text-strong)",
                  )}
                  style={{
                    // Value height is invariant — only the colour drops to
                    // faint when a read is unresolved. Keeping 20px across
                    // resolved and muted cells holds a clean baseline rhythm
                    // instead of collapsing muted rows to a shorter line.
                    fontSize: "var(--ct-text-2xl-fixed)",
                    lineHeight: 1.15,
                  }}
                >
                  {item.value}
                </p>
                {item.hint ? (
                  <p
                    className="m-0 truncate text-(--ct-text-faint)"
                    style={{ fontSize: "var(--ct-text-nano)" }}
                  >
                    {item.hint}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
