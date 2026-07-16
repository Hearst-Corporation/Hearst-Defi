import type { ChartConfig } from "@/components/ui/chart";
import { ASSET_TOKEN } from "@/lib/ds/asset-tokens";

/** BTC accumulation area — total + mining-produced overlay. */
export const ACCUMULATION_CHART_CONFIG = {
  actual: { label: "Total BTC accumulated", color: ASSET_TOKEN.btc },
  mining: { label: "Mining-produced BTC", color: ASSET_TOKEN.mining },
  reference: { label: "Reference path", color: ASSET_TOKEN.neutral },
} satisfies ChartConfig;

/** Accent (product-green) variant of the accumulation chart — Dashboard tone.
 *  Same series keys/labels as ACCUMULATION_CHART_CONFIG; only colours change. */
export const ACCUMULATION_CHART_CONFIG_ACCENT = {
  actual: { label: "Total BTC accumulated", color: "var(--ct-accent)" },
  mining: { label: "Mining-produced BTC", color: "var(--ct-chart-series-2)" },
  reference: { label: "Reference path", color: "var(--ct-chart-neutral)" },
} satisfies ChartConfig;

/** Tone switch for the shared accumulation chart (D2): Dashboard = accent
 *  green, /btc = asset orange. */
export type AccumulationChartTone = "accent" | "btc";

export const ACCUMULATION_CHART_CONFIGS: Record<AccumulationChartTone, ChartConfig> = {
  accent: ACCUMULATION_CHART_CONFIG_ACCENT,
  btc: ACCUMULATION_CHART_CONFIG,
};

/** Strategy composition donut — 40 / 27 / 33 pockets. */
export const STRATEGY_DONUT_CONFIG = {
  value: { label: "Allocation" },
  mining: { label: "Mining Power", color: ASSET_TOKEN.mining },
  btc: { label: "Bitcoin Reserve", color: ASSET_TOKEN.btc },
  ops: { label: "Operating Reserve", color: ASSET_TOKEN.usdc },
} satisfies ChartConfig;

/** Monthly sources stacked bar — each source explicitly named (PROMPT 236:
 *  never the vague "Strategic BTC"). "mining" = credits from fleet production;
 *  "strategic" = BTC bought into the B2 reserve pouch. */
export const SOURCES_STACKED_CONFIG = {
  mining: { label: "Mining credits", color: ASSET_TOKEN.mining },
  strategic: { label: "Reserve acquisitions", color: ASSET_TOKEN.btc },
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
