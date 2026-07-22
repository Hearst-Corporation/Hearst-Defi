// Series1DashboardHero — the DS `HeroKpiBand`.
//
// Reproduces the Qatar cockpit recipe exactly (design-system.html §09):
//   - a 12-column grid: hero `col-span-4`, secondaries `col-span-8 lg:grid-cols-3`
//   - separators are `gap-px` over a `white/5` ground, NEVER drawn borders —
//     that is what gives the grid without a drawn line
//   - hero label in `uppercase tracking-[0.12em]` accent
//   - hero number `text-4xl→6xl font-semibold tracking-tight tabular-nums`
//   - the whole band is welded INSIDE one surfaceRaised card
//
// Note on `gap-px`: the dashboard canon banned it (F2) because the old
// Series1KpiBand used it on SEVEN BARE CELLS, so the gutter was the only
// chrome and the band read as a spreadsheet. The DS uses the same mechanism
// legitimately — welded inside a single raised card, with one dominant figure
// carrying the hierarchy. That is the difference between a cockpit band and a
// table, and it is why the pattern is safe here.
//
// Accent: green `--ct-accent` (Hearst brand, CI-locked in ds-token-drift.mjs).
// The DS's bordeaux is the Qatar programme's accent; the GRAMMAR transfers,
// the hue does not.

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
    <section className="overflow-hidden rounded-[var(--ct-radius-xl)] bg-[var(--ct-surface-raised)] shadow-[var(--ct-shadow-soft)] ring-1 ring-[var(--ct-border)]">
      {/* Programme line — above the band, on the card's own ground. */}
      <div className="px-[var(--ct-space-6)] pt-[var(--ct-space-5)] pb-[var(--ct-space-4)]">
        <p
          className="m-0 font-semibold uppercase tracking-[0.12em] text-[var(--ct-accent-strong)]"
          style={{ fontSize: "var(--ct-text-2xs)" }}
        >
          {eyebrow}
        </p>
      </div>

      {/* The band itself: gap-px over a white/5 ground = the DS separator. */}
      <div className="grid gap-px bg-[var(--ct-border-soft)] lg:grid-cols-12">
        {/* Hero cell — col-span-4. */}
        <div className="min-w-0 bg-[var(--ct-surface-raised)] px-[var(--ct-space-6)] py-[var(--ct-space-6)] lg:col-span-4">
          <p
            className="m-0 font-medium uppercase tracking-[0.12em] text-[var(--ct-text-muted)]"
            style={{ fontSize: "var(--ct-text-2xs)" }}
          >
            {label}
          </p>
          <div
            className={cn(
              "mt-[var(--ct-space-3)] font-semibold tracking-tight tabular-nums",
              muted ? "text-[var(--ct-text-faint)]" : "text-[var(--ct-text-strong)]",
            )}
            style={{ fontSize: "var(--ct-text-hero)", lineHeight: 1 }}
          >
            {value}
          </div>
          <p
            className="m-0 mt-[var(--ct-space-3)] leading-relaxed text-[var(--ct-text-muted)]"
            style={{ fontSize: "var(--ct-text-2xs)" }}
          >
            {caption}
          </p>
          {trailing ? <div className="mt-[var(--ct-space-2)]">{trailing}</div> : null}
        </div>

        {/* Secondary cells — col-span-8, three across. */}
        <dl className="grid min-w-0 grid-cols-1 gap-px bg-[var(--ct-border-soft)] sm:grid-cols-2 lg:col-span-8 lg:grid-cols-3">
          {context.map((item) => (
            <div
              key={item.label}
              className="min-w-0 bg-[var(--ct-surface-raised)] px-[var(--ct-space-5)] py-[var(--ct-space-4)]"
            >
              <dt
                className="m-0 font-medium text-[var(--ct-text-muted)]"
                style={{ fontSize: "var(--ct-text-2xs)" }}
              >
                {item.label}
              </dt>
              <dd
                className={cn(
                  "m-0 mt-[var(--ct-space-1)] truncate font-semibold tracking-tight tabular-nums",
                  item.muted
                    ? "text-[var(--ct-text-faint)]"
                    : "text-[var(--ct-text-strong)]",
                )}
                style={{ fontSize: "var(--ct-text-3xl-fixed)", lineHeight: 1.15 }}
              >
                {item.value}
              </dd>
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
        </dl>
      </div>
    </section>
  );
}
