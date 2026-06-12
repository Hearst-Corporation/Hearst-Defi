/**
 * Canonical allocation palette for **web UI** (dark Cockpit).
 *
 * Source of truth for donut strokes, legend dots, and scenario allocation bars.
 * Dashboard bento (`dashboard/page.tsx` + `.dash-chart-circle.color-*`) is the
 * reference; PDF uses `PDF_ALLOCATION` in `src/lib/pdf/pdf-palette.ts`.
 *
 * Do not hardcode per-component `BUCKET_COLOR` / `BUCKET_TONES` maps — import here.
 */

import type { AllocationBucket as EngineBucket } from "@/lib/engine/types";

export type AllocationDashTone = "primary" | "accent" | "soft" | "muted";

/** CSS `stroke` / `color` for engine bucket ids (`btc_tactical`, …). */
export const ALLOCATION_STROKE: Record<EngineBucket, string> = {
  mining: "var(--ct-text-primary)",
  btc_tactical: "var(--ct-accent-strong)",
  usdc_base: "var(--ct-status-info)",
  stable_reserve: "var(--ct-status-warning)",
};

/** Class suffix for `.dash-chart-circle.color-*` and `.dash-legend-dot.dot-*`. */
export const ALLOCATION_DASH_TONE: Record<EngineBucket, AllocationDashTone> = {
  mining: "primary",
  btc_tactical: "accent",
  usdc_base: "soft",
  stable_reserve: "muted",
};

export const ALLOCATION_LABELS: Record<EngineBucket, string> = {
  mining: "Mining",
  btc_tactical: "BTC Tactical",
  usdc_base: "USDC Base",
  stable_reserve: "Stable Reserve",
};

const HYPHEN_ID_TO_ENGINE: Record<string, EngineBucket> = {
  mining: "mining",
  "btc-tactical": "btc_tactical",
  "usdc-base": "usdc_base",
  "stable-reserve": "stable_reserve",
};

/** Resolve mock/dashboard hyphen ids or engine underscore ids to a stroke color. */
export function allocationStrokeFor(bucket: string): string {
  const key = HYPHEN_ID_TO_ENGINE[bucket] ?? (bucket as EngineBucket);
  return ALLOCATION_STROKE[key] ?? "var(--ct-surface-3)";
}

export function allocationDashToneFor(bucket: string): AllocationDashTone {
  const key = HYPHEN_ID_TO_ENGINE[bucket] ?? (bucket as EngineBucket);
  return ALLOCATION_DASH_TONE[key] ?? "muted";
}

export function allocationLabelFor(bucket: string): string {
  const key = HYPHEN_ID_TO_ENGINE[bucket] ?? (bucket as EngineBucket);
  return ALLOCATION_LABELS[key] ?? bucket;
}
