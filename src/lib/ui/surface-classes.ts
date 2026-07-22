/**
 * Composer 2.5 surface hierarchy — shared grammar for investor + operator dashboards.
 *
 * Depth model (docs/front-dashboard-zero-rebuild-canon.md §4):
 *   canvas → page gutter, no shadow
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

const SURFACE_BASE: Record<SurfaceVariant, string> = {
  canvas: "min-w-0 overflow-x-hidden",
  hero:
    "min-w-0 overflow-hidden rounded-(--ct-radius-xl) bg-[color-mix(in_srgb,var(--ct-bg-deep)_60%,var(--ct-surface-page))] shadow-(--ct-shadow-elevated) ring-1 ring-(--ct-border)",
  primary:
    "flex min-w-0 flex-col overflow-hidden rounded-(--ct-radius-xl) bg-[color-mix(in_srgb,var(--ct-bg-deep)_65%,var(--ct-surface-page))] ring-1 ring-(--ct-border) shadow-(--ct-shadow-elevated)",
  secondary:
    "flex min-w-0 flex-col overflow-hidden rounded-(--ct-radius-xl) bg-[color-mix(in_srgb,var(--ct-bg-deep)_75%,var(--ct-surface-page))] ring-1 ring-(--ct-border-soft) shadow-(--ct-shadow-soft)",
  quiet:
    "flex min-w-0 flex-col overflow-hidden rounded-(--ct-radius-xl) bg-[color-mix(in_srgb,var(--ct-bg-deep)_85%,var(--ct-surface-page))] ring-1 ring-(--ct-border-soft)",
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
