/**
 * Composer 2.5 surface hierarchy — the DEPTH-CLASSNAME bridge for Series1 modules.
 *
 * DS convergence (target-map "Earth = Hearst"): the intended end-state is Catalyst
 * <Card> as the single primitive authority, with this module reduced to the *depth*
 * className layered on top. In practice the outer Series1 surfaces stay plain <div>s
 * painted by `surfaceClassName()` because <Card>'s UNLAYERED `.ct-glass-panel`
 * (`border`, `box-shadow: none`) and `.ct-card` (`padding`) rules override the
 * utility-layer ring/shadow/bg these variants rely on — delegating the outer
 * container would move pixels (see the notes in Series1DashboardSection /
 * Series1Panel). This file is therefore NOT a component API and NOT a second
 * surface authority: it is only the depth grammar, tokens-only, that those wrappers
 * apply. Nested label/value rows converge on `Series1RowBase` (Series1Panel.tsx).
 *
 * Depth model (docs/front-dashboard-zero-rebuild-canon.md §4):
 *   canvas → page gutter, no shadow (not a card — plain wrapper)
 *   hero   → dominant band, elevated shadow, accent hairline
 *   primary / secondary / quiet → cards by visual weight
 *   inset  → wells recessed inside a parent card
 *
 * Tokens only — no raw hex, no Tailwind green/emerald, no bordeaux.
 */

import { cn } from "@/lib/cn";

export type SurfaceVariant =
  | "canvas"
  | "hero"
  | "primary"
  | "secondary"
  | "quiet"
  | "inset";

// Cockpit remediation (Earth = Hearst): ONE depth hierarchy, not three stacked
// strata. The shell content card now carries a single soft shadow, so the inner
// surfaces step DOWN from there instead of each re-asserting an elevated shadow:
//   hero      → the page thesis, the only dominant raised band (keeps elevated)
//   primary   → present but calmer (depth, not elevated)
//   secondary → borderless: hairline ring, no shadow (KPI/lists "peu encagés")
//   quiet     → flat surface, no ring, no shadow (registers read as one plane)
//   inset     → recessed well (unchanged)
// Direction: "profondeur sans surcharge, listes borderless, aucun glow".
const SURFACE_BASE: Record<SurfaceVariant, string> = {
  canvas: "min-w-0 overflow-x-hidden",
  hero:
    "min-w-0 overflow-hidden rounded-(--ct-radius-xl) bg-[color-mix(in_srgb,var(--ct-bg-deep)_60%,var(--ct-surface-page))] shadow-(--ct-shadow-elevated) ring-1 ring-(--ct-border)",
  primary:
    "flex min-w-0 flex-col overflow-hidden rounded-(--ct-radius-xl) bg-[color-mix(in_srgb,var(--ct-bg-deep)_65%,var(--ct-surface-page))] ring-1 ring-(--ct-border-soft) shadow-(--ct-shadow-depth)",
  secondary:
    "flex min-w-0 flex-col overflow-hidden rounded-(--ct-radius-xl) bg-[color-mix(in_srgb,var(--ct-bg-deep)_75%,var(--ct-surface-page))] ring-1 ring-(--ct-border-soft)",
  quiet:
    "flex min-w-0 flex-col overflow-hidden rounded-(--ct-radius-xl) bg-[color-mix(in_srgb,var(--ct-bg-deep)_85%,var(--ct-surface-page))]",
  inset:
    "min-w-0 bg-[color-mix(in_srgb,var(--ct-bg-deep)_90%,var(--ct-surface-page))] ring-1 ring-inset ring-(--ct-border-soft) shadow-(--ct-shadow-inset)",
};

/** Top accent hairline for hero surfaces — one per hero, never repeated inside. */
export const surfaceHeroAccentLine = "h-px bg-(--ct-border-accent)";

/** Footer / notice well — recesses below card body without becoming a second card. */
export const surfaceNoticeWell =
  "border-t border-(--ct-border-soft) bg-[color-mix(in_srgb,var(--ct-bg-deep)_95%,var(--ct-surface-page))]";

/** Explorer / on-chain link hover — shared across proof surfaces. */
export const explorerLinkClass =
  "hover:ct-text-strong transition-colors duration-[var(--ct-dur-fast)]";

export function surfaceClassName(
  variant: SurfaceVariant,
  className?: string,
): string {
  return cn(SURFACE_BASE[variant], className);
}
