// Series1DashboardHero — the dominant read of the investor dashboard.
//
// Canon §2: the Series 1 investor screen is a premium Bitcoin reserve cockpit,
// and the dominant read is ACCUMULATED BTC delivered at maturity — not total
// assets, and never a market-price-derived figure. The old page led with
// "Total assets" inside a 7-cell divider grid; capital deployed is context for
// the accumulation, not the headline.
//
// Typography follows canon §8: the hero number is FIXED and token-driven
// (--ct-text-hero, 40px), never a fluid `text-4xl sm:text-5xl` ramp.

import type { ReactNode } from "react";

import { Series1DashboardCard } from "./Series1DashboardSection";

export interface Series1HeroContext {
  label: string;
  value: ReactNode;
  /** True when the underlying read did not resolve — renders quiet. */
  muted?: boolean;
}

export function Series1DashboardHero({
  eyebrow,
  label,
  value,
  muted = false,
  caption,
  context,
  trailing,
}: {
  /** Product line, e.g. "Hearst Bitcoin Reserve Vault · Series 1". */
  eyebrow: string;
  /** What the hero number IS, e.g. "Bitcoin accumulated". */
  label: string;
  value: ReactNode;
  muted?: boolean;
  /** One-line honest framing under the number. */
  caption: ReactNode;
  /** Two or three supporting figures, inline — not a KPI grid. */
  context: readonly Series1HeroContext[];
  /** Provenance or motive slot, top-right. */
  trailing?: ReactNode;
}) {
  return (
    <Series1DashboardCard>
      <div className="flex flex-col gap-[var(--ct-space-6)] p-[var(--ct-space-6)] lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p
            className="m-0 font-semibold uppercase tracking-[0.14em] text-[var(--ct-text-faint)]"
            style={{ fontSize: "var(--ct-text-deci)" }}
          >
            {eyebrow}
          </p>

          <p
            className="m-0 mt-[var(--ct-space-4)] text-[var(--ct-text-muted)]"
            style={{ fontSize: "var(--ct-text-2xs)" }}
          >
            {label}
          </p>
          <div
            className={
              muted
                ? "mt-[var(--ct-space-2)] font-semibold tracking-tight tabular-nums text-[var(--ct-text-faint)]"
                : "mt-[var(--ct-space-2)] font-semibold tracking-tight tabular-nums text-[var(--ct-text-strong)]"
            }
            style={{ fontSize: "var(--ct-text-hero)", lineHeight: 1.05 }}
          >
            {value}
          </div>
          <p
            className="m-0 mt-[var(--ct-space-3)] max-w-[56ch] leading-relaxed text-[var(--ct-text-muted)]"
            style={{ fontSize: "var(--ct-text-xs)" }}
          >
            {caption}
          </p>
        </div>

        {trailing ? <div className="shrink-0">{trailing}</div> : null}
      </div>

      {/* Supporting figures — an inset strip that RECESSES under the hero
          (canon §4), separated by hairlines drawn per cell rather than by a
          `gap-px` grid gutter (canon F2). */}
      {context.length > 0 ? (
        <div className="flex flex-col border-t border-[var(--ct-border-soft)] bg-[var(--ct-surface-inset)] sm:flex-row">
          {context.map((item) => (
            <div
              key={item.label}
              className="min-w-0 flex-1 px-[var(--ct-space-5)] py-[var(--ct-space-4)] not-first:border-t not-first:border-[var(--ct-border-soft)] sm:not-first:border-t-0 sm:not-first:border-l"
            >
              <p
                className="m-0 text-[var(--ct-text-faint)]"
                style={{ fontSize: "var(--ct-text-nano)" }}
              >
                {item.label}
              </p>
              <p
                className={
                  item.muted
                    ? "m-0 mt-[var(--ct-space-1)] truncate font-semibold tabular-nums text-[var(--ct-text-faint)]"
                    : "m-0 mt-[var(--ct-space-1)] truncate font-semibold tabular-nums text-[var(--ct-text-strong)]"
                }
                style={{ fontSize: "var(--ct-text-xl-fixed)" }}
              >
                {item.value}
              </p>
            </div>
          ))}
        </div>
      ) : null}
    </Series1DashboardCard>
  );
}
