import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export interface Series1HeroContext {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
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
  /** The secondary KPI cells welded to the right of the hero. */
  context: readonly Series1HeroContext[];
  /** Provenance slot, rendered under the hero caption. */
  trailing?: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-[var(--ct-radius-xl)] bg-[color-mix(in_srgb,var(--ct-bg-deep)_65%,var(--ct-surface-page))] shadow-[var(--ct-shadow-elevated)] ring-1 ring-[var(--ct-border)]">
      <div className="h-px bg-[var(--ct-border-accent)]" />
      <div className="px-[var(--ct-space-6)] pt-[var(--ct-space-5)]">
        <p
          className="m-0 font-semibold uppercase tracking-[0.12em] text-[var(--ct-accent-strong)]"
          style={{ fontSize: "var(--ct-text-2xs)" }}
        >
          {eyebrow}
        </p>
      </div>

      <div className="px-[var(--ct-space-6)] pb-[var(--ct-space-6)] pt-[var(--ct-space-4)]">
        <div className="grid min-w-0 gap-0 overflow-hidden rounded-[var(--ct-radius-lg)] border border-[var(--ct-border-soft)] bg-[color-mix(in_srgb,var(--ct-bg-deep)_72%,var(--ct-surface-page))] lg:grid-cols-[1.15fr_1fr]">
          <div className="flex min-w-0 flex-col justify-center border-b border-[var(--ct-border-soft)] px-[var(--ct-space-5)] py-[var(--ct-space-5)] lg:border-b-0 lg:border-r">
            <p
              className="m-0 flex items-center gap-[var(--ct-space-2)] font-medium text-[var(--ct-text-muted)]"
              style={{ fontSize: "var(--ct-text-2xs)" }}
            >
              <span
                aria-hidden
                className="inline-block size-1.5 shrink-0 rounded-full bg-[var(--ct-accent)]"
              />
              {label}
            </p>
            {muted ? (
              <p
                className="m-0 mt-[var(--ct-space-3)] font-medium text-[var(--ct-text-faint)]"
                style={{ fontSize: "var(--ct-text-2xs)" }}
              >
                Not yet reported
              </p>
            ) : (
              <div
                className="mt-[var(--ct-space-3)] font-semibold tracking-tight tabular-nums text-[var(--ct-text-strong)]"
                style={{ fontSize: "var(--ct-text-hero)", lineHeight: 1 }}
              >
                {value}
              </div>
            )}
            <p
              className="m-0 mt-[var(--ct-space-3)] max-w-[56ch] leading-relaxed text-[var(--ct-text-muted)]"
              style={{ fontSize: "var(--ct-text-2xs)" }}
            >
              {caption}
            </p>
            {trailing ? <div className="mt-[var(--ct-space-2)]">{trailing}</div> : null}
          </div>
          <div className="grid min-w-0 grid-cols-1 gap-0 sm:grid-cols-2">
            {context.map((item) => (
            <div
              key={item.label}
              className={cn(
                "min-w-0 px-[var(--ct-space-4)] py-[var(--ct-space-3)]",
                "border-t border-[var(--ct-border-soft)] sm:[&:nth-child(-n+2)]:border-t-0 sm:[&:nth-child(odd)]:border-r",
              )}
            >
              <p
                className="m-0 font-medium text-[var(--ct-text-muted)]"
                style={{ fontSize: "var(--ct-text-2xs)" }}
              >
                {item.label}
              </p>
              <p
                className={cn(
                  "m-0 mt-[var(--ct-space-1)] truncate font-semibold tracking-tight tabular-nums",
                  item.muted
                    ? "text-[var(--ct-text-faint)]"
                    : "text-[var(--ct-text-strong)]",
                )}
                style={{
                  fontSize: item.muted
                    ? "var(--ct-text-2xs)"
                    : "var(--ct-text-xl-fixed)",
                  lineHeight: 1.2,
                }}
              >
                {item.value}
              </p>
              {item.hint ? (
                <p
                  className="m-0 mt-[var(--ct-space-1)] truncate text-[var(--ct-text-faint)]"
                  style={{ fontSize: "var(--ct-text-nano)" }}
                >
                  {item.hint}
                </p>
              ) : null}
            </div>
          ))}
          </div>
        </div>
      </div>
    </section>
  );
}
