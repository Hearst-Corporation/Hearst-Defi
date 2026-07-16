// Figure — the term-sheet numeral (P0.6). ONE way to typeset a value that
// carries a unit anywhere on the cockpit surfaces:
//
//   digits : tabular-nums, full size, tracking-tight, leading-none
//   unit   : ~55% of the value size, uppercase, tracking-widest, muted,
//            locked on the digits' baseline ("BTC", "USD", "/ 24", "TH/s")
//
// Presentation-only, server-safe: the value arrives pre-formatted (string /
// number / node), no math here. Size contract follows the optical-primacy
// rule (P0.2): "lead" = the band's single 32px master figure, "base" = the
// standard 22px figure, "inherit" (default) takes the parent's font size so
// the Figure can sit inside an already-sized line ("Month <Figure/>").
//
// The unit is separated from the digits by a real text space so the rendered
// text content stays "0.52 BTC" for copy/paste and assistive tech.

import { cn } from "@/lib/cn";

const SIZE_CLASS = {
  /** The band's ONE master figure — 32px semibold (optical primacy, P0.2). */
  lead: "text-[length:var(--ct-text-display-fixed)] font-semibold",
  /** Standard KPI figure — 22px medium. */
  base: "text-[length:var(--ct-text-2xl)] font-medium",
  /** Takes the parent's font size (the unit still scales at 0.55em). */
  inherit: "",
} as const;

export type FigureSize = keyof typeof SIZE_CLASS;

export interface FigureProps {
  /** Pre-formatted digits — "0.5170", "$262,700", 12. No math here. */
  value: React.ReactNode;
  /** Unit / qualifier suffix — "BTC", "USD", "/ 24", "TH/s", "movements". */
  unit?: string | null;
  /** "lead" 32px · "base" 22px · "inherit" (default) parent size. */
  size?: FigureSize;
  /** Tone/color class for the digits (e.g. "ct-text-accent"). */
  className?: string;
}

export function Figure({ value, unit, size = "inherit", className }: FigureProps) {
  return (
    <span className={cn("tabular tracking-tight leading-none", SIZE_CLASS[size], className)}>
      {value}
      {unit != null && unit !== "" ? (
        <>
          {" "}
          <span className="text-[0.55em] font-medium uppercase tracking-[var(--ct-tracking-widest)] ct-text-muted">
            {unit}
          </span>
        </>
      ) : null}
    </span>
  );
}
