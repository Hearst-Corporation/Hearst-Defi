/**
 * Compat façade — single-DS convergence.
 * Canonical source moved to `@/components/catalyst/chart-time-selector`.
 * This thin re-export preserves the legacy `@/components/ui/chart-time-selector`
 * path and its `ChartTimeSelector` / `TimeRange` / `ChartTimeSelectorProps` API
 * byte-for-byte. Do not add logic here.
 */
export { ChartTimeSelector } from "@/components/catalyst/chart-time-selector";
export type {
  TimeRange,
  ChartTimeSelectorProps,
} from "@/components/catalyst/chart-time-selector";
