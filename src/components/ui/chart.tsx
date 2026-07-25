"use client";

/**
 * Compatibility re-export shim (HC-CHART-001).
 *
 * The canonical, tokenised Recharts chart layer now lives at
 * `@/components/catalyst/chart`. This file has NO independent implementation —
 * it only re-exports the Catalyst module so the existing
 * `@/components/ui/chart` import sites keep working. It is intentionally kept
 * here because `scripts/ds-convergence-guard.mjs` allowlists `ui/chart.tsx` to
 * live under `src/components/ui/`. New code must import from
 * `@/components/catalyst/chart`.
 */

export {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  ChartStyle,
} from "@/components/catalyst/chart";
export type { ChartConfig } from "@/components/catalyst/chart";
