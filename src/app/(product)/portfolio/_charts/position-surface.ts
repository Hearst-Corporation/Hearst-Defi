// The ONE card surface for the /portfolio cockpit — a cell-for-cell match of the
// reference design system's `surfaceRaised` (Design system — Hearst Qatar
// Management Cockpit §Surfaces), expressed on Hearst tokens with the green accent.
//
// Reference (dark):  rounded-xl  bg-zinc-900  ring-1 ring-white/10  shadow-lg
// Hearst tokens:     --ct-surface-page (#18181b = zinc-900, FLAT — no bg-deep
//                    mix that would darken it), --ct-border (#ffffff20 ≈ white/12),
//                    --ct-shadow-lg.
//
// The page itself sits on the darker page ground, so a #18181b card reads as ONE
// step lighter than the canvas — exactly the two-level depth the reference uses
// (page zinc-950 → card zinc-900). No pure black, no third stratum.
export const POSITION_CARD_SURFACE =
  "min-w-0 overflow-hidden rounded-[var(--ct-radius-xl)] bg-[var(--ct-surface-page)] ring-1 ring-[var(--ct-border)] shadow-[var(--ct-shadow-lg)]";
