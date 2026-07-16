// HairlineProgress — THE single machined progress bar of the cockpit (P1.3).
// Replaces the 4 inline duplications (dashboard ops-row capacity, /btc ops-row
// maturity, and the ReportingPeriodCell bar shared by both heroes) with one
// component so the bar is an OBJECT, not a recipe.
//
// Matière (usinage) — INSET only, FLAT respected (zero drop-shadow, zero halo):
//   track : --ink-hairline ground + `inset 0 1px 2px rgba(0,0,0,.35)` (rainure)
//   fill  : tone colour + `inset 0 1px 0 rgba(255,255,255,.15)` (arête éclairée)
//
// Decorative by contract: every call site carries the same figure in text for
// screen readers ("% complete", "x.x% vault utilization", "Month x / y"), so
// the whole bar is aria-hidden — no double announcement.
//
// Server component, presentation-only: pct arrives computed, clamped here to
// [0, 100] as pure display guard (no business math).

import { cn } from "@/lib/cn";

export type HairlineProgressTone = "accent" | "btc";

const TONE_FILL: Record<HairlineProgressTone, string> = {
  accent: "var(--ct-accent)",
  btc: "var(--ct-asset-btc)",
};

export interface HairlineProgressProps {
  /** Fill percentage — clamped to [0, 100] for display. */
  pct: number;
  /** Fill colour: green on /dashboard surfaces, BTC-orange on /btc. */
  tone?: HairlineProgressTone;
  className?: string;
}

export function HairlineProgress({ pct, tone = "accent", className }: HairlineProgressProps) {
  const width = Math.min(100, Math.max(0, pct));
  return (
    <div
      aria-hidden="true"
      className={cn(
        "h-1 w-full overflow-hidden rounded-full bg-[var(--ink-hairline)]",
        "shadow-[inset_0_1px_2px_rgba(0,0,0,0.35)]",
        className,
      )}
    >
      <div
        className="h-full rounded-full shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]"
        style={{ width: `${width}%`, background: TONE_FILL[tone] }}
      />
    </div>
  );
}
