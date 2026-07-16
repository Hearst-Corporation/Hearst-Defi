import type { ChartConfig } from "@/components/ui/chart";
import { ASSET_TOKEN } from "@/lib/ds/asset-tokens";

/** BTC accumulation area — total + mining-produced overlay. */
export const ACCUMULATION_CHART_CONFIG = {
  actual: { label: "Total BTC accumulated", color: ASSET_TOKEN.btc },
  mining: { label: "Mining-produced BTC", color: ASSET_TOKEN.mining },
  reference: { label: "Reference path", color: ASSET_TOKEN.neutral },
} satisfies ChartConfig;

/** Strategy composition donut — 40 / 27 / 33 pockets. */
export const STRATEGY_DONUT_CONFIG = {
  value: { label: "Allocation" },
  mining: { label: "Mining Power", color: ASSET_TOKEN.mining },
  btc: { label: "Bitcoin Reserve", color: ASSET_TOKEN.btc },
  ops: { label: "Operating Reserve", color: ASSET_TOKEN.usdc },
} satisfies ChartConfig;

/** Monthly sources stacked bar. */
export const SOURCES_STACKED_CONFIG = {
  mining: { label: "Mining-produced BTC", color: ASSET_TOKEN.mining },
  strategic: { label: "Strategic BTC", color: ASSET_TOKEN.btc },
} satisfies ChartConfig;

/** Mining pulse monthly production bars. */
export const MINING_PULSE_CONFIG = {
  value: { label: "BTC produced", color: ASSET_TOKEN.mining },
  inactive: { label: "Inactive", color: ASSET_TOKEN.neutral },
} satisfies ChartConfig;

/** USDC reserve runway micro-chart. */
export const RESERVE_RUNWAY_CONFIG = {
  covered: { label: "Covered months", color: ASSET_TOKEN.usdc },
  remaining: { label: "Remaining runway", color: ASSET_TOKEN.neutral },
} satisfies ChartConfig;
