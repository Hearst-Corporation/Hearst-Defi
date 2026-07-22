// Series1DashboardHero — the DS `HeroKpiBand`.
//
// Follows the Qatar cockpit recipe (design-system.html §09):
//   - a 12-column grid: hero `col-span-4 row-span-2`, six secondaries
//     `col-span-4` each — ALL of them direct children of the same grid, so
//     every cell shares the same row tracks
//   - separators are `gap-px` over a `white/5` ground, NEVER drawn borders —
//     that is what gives the grid without a drawn line
//   - hero number `font-semibold tracking-tight tabular-nums` at the 40px tier
//   - the whole band is welded INSIDE one surfaceRaised card
//
// The DS puts the secondaries in their own nested grid. That is the one place
// this diverges, and deliberately: a nested subgrid's height is independent of
// the hero cell's, so the gap-px ground only painted where the two happened to
// overlap and the hairlines stopped halfway down the band.
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
    <section className="overflow-hidden rounded-[var(--ct-radius-xl)] bg-[var(--ct-surface-raised)] shadow-[var(--ct-shadow-elevated)] ring-1 ring-[var(--ct-border)]">
      {/* Programme line — above the band, on the card's own ground. */}
      <div className="px-[var(--ct-space-6)] pt-[var(--ct-space-5)] pb-[var(--ct-space-4)]">
        <p
          className="m-0 font-semibold uppercase tracking-[0.12em] text-[var(--ct-accent-strong)]"
          style={{ fontSize: "var(--ct-text-2xs)" }}
        >
          {eyebrow}
        </p>
      </div>

      {/* The band: ONE grid, every cell a DIRECT child.
          The previous version nested the six secondaries in their own <dl>
          grid. That subgrid's total height is independent of the hero cell's,
          so the gap-px ground only showed where both happened to overlap —
          the separators stopped halfway down and the band looked broken.
          A single 12-column grid makes every cell share the same row tracks,
          so the hairlines run the full height. */}
      <div className="grid gap-px bg-[var(--ct-border-soft)] sm:grid-cols-2 lg:grid-cols-12">
        {/* Hero cell — col-span-4, spanning both secondary rows. */}
        <div className="flex min-w-0 flex-col justify-center bg-[var(--ct-surface-raised)] px-[var(--ct-space-6)] py-[var(--ct-space-6)] sm:col-span-2 lg:col-span-4 lg:row-span-2">
          {/* Label in the normal register, NOT uppercase: the programme line
              above is already an eyebrow, and two stacked letter-spaced caps
              made the hero read as a header with nothing under it. */}
          <p
            className="m-0 font-medium text-[var(--ct-text-muted)]"
            style={{ fontSize: "var(--ct-text-2xs)" }}
          >
            {label}
          </p>
          {/* An unresolved hero renders its STATE in words, not a 40px em dash
              — a lone giant hyphen is what made this cell look empty while the
              secondary "12.00 USDC" dominated the band. But the words drop to
              the LABEL tier, same as every other muted cell on the page: at
              24px semibold it was as loud as a real hero figure and competed
              with resolved values elsewhere on the screen instead of reading
              as an absence. */}
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
            className="m-0 mt-[var(--ct-space-3)] leading-relaxed text-[var(--ct-text-muted)]"
            style={{ fontSize: "var(--ct-text-2xs)" }}
          >
            {caption}
          </p>
          {trailing ? <div className="mt-[var(--ct-space-2)]">{trailing}</div> : null}
        </div>

        {/* Secondary cells — DIRECT children of the 12-col grid, 4 columns
            each, so they share the hero's row tracks and the hairlines line up.
            Vertical padding is tighter than the hero's: the hero cell breathes
            (py-6) while these sit closer together (py-3) so the band reads as
            one dominant instrument with six subordinate readouts, not seven
            equal table cells. */}
        {context.map((item) => (
            <div
              key={item.label}
              className="min-w-0 bg-[var(--ct-surface-raised)] px-[var(--ct-space-5)] py-[var(--ct-space-3)] lg:col-span-4"
            >
              <p
                className="m-0 font-medium text-[var(--ct-text-muted)]"
                style={{ fontSize: "var(--ct-text-2xs)" }}
              >
                {item.label}
              </p>
              {/* 18px, not 24px: a secondary cell must READ as secondary. At
                  the display tier they competed with the hero number and long
                  strings ("Legacy vault · v2.1 address TBD") truncated. The DS
                  band works because one figure dominates.
                  An unresolved cell drops to the label tier: a big em dash is
                  visual noise that reads as loud as a real figure. */}
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
    </section>
  );
}
