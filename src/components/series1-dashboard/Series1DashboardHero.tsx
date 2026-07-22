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
    <section className="overflow-hidden rounded-(--ct-radius-xl) bg-[color-mix(in_srgb,var(--ct-bg-deep)_60%,var(--ct-surface-page))] shadow-(--ct-shadow-elevated) ring-1 ring-(--ct-border)">
      <div className="h-px bg-(--ct-border-accent)" />
      <div className="px-(--ct-space-6) pb-(--ct-space-4) pt-(--ct-space-5)">
        <p
          className="m-0 font-semibold uppercase tracking-[0.12em] text-(--ct-accent-strong)"
          style={{ fontSize: "var(--ct-text-2xs)" }}
        >
          {eyebrow}
        </p>
      </div>

      <div className="grid w-full min-w-0 gap-0 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="flex min-h-[15.5rem] min-w-0 flex-col justify-center gap-(--ct-space-6) border-b border-(--ct-border-soft) px-(--ct-space-6) pb-(--ct-space-6) lg:border-b-0 lg:border-r">
          <div className="min-w-0">
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
        <div className="grid min-w-0 grid-cols-1 gap-0 sm:grid-cols-2 lg:px-(--ct-space-2) lg:pb-(--ct-space-4)">
          {context.map((item) => (
            <div
              key={item.label}
              className={cn(
                "min-w-0 px-(--ct-space-4) py-(--ct-space-3)",
                "border-t border-(--ct-border-soft) sm:nth-[-n+2]:border-t-0 sm:odd:border-r",
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
                  "m-0 mt-(--ct-space-1) truncate font-semibold tracking-tight tabular-nums",
                  item.muted
                    ? "text-(--ct-text-faint)"
                    : "text-(--ct-text-strong)",
                )}
                style={{
                  fontSize: item.muted
                    ? "var(--ct-text-xs)"
                    : "var(--ct-text-2xl-fixed)",
                  lineHeight: 1.15,
                }}
              >
                {item.value}
              </p>
              {item.hint ? (
                <p
                  className="m-0 mt-(--ct-space-1) truncate text-(--ct-text-faint)"
                  style={{ fontSize: "var(--ct-text-nano)" }}
                >
                  {item.hint}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
