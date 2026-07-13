/**
 * Hearst Instrument System (HIS) — P0 visual primitives barrel.
 *
 * Single import surface for the data-viz primitives. Product surfaces
 * (portfolio, payments, projection, investor report) consume these in later
 * lots (P1/P2); this lot ships the library + tests only, nothing is wired yet.
 *
 * Not yet implemented (P1+): HcLineChart, HcBandChart, HcContributionBar,
 * HcTornado, HcSourceMatrix, HcDependencyDiagram.
 * (HcBullet lives at app/(product)/portfolio/preview/_charts/bullet — a product
 * primitive already consumed by three pages; promotion into this barrel is
 * deferred to avoid churning its import sites for no visual gain.)
 */

export * from "./types";
export * from "./geometry";

export { HcBarChart } from "./HcBarChart";
export type { HcBarChartProps, HcBar } from "./HcBarChart";

export { HcStackedBar } from "./HcStackedBar";
export type { HcStackedBarProps } from "./HcStackedBar";

export { HcChartCard } from "./HcChartCard";
export type { HcChartCardProps, HcChartCardState } from "./HcChartCard";

export { HcSourceBadge } from "./HcSourceBadge";
export type { HcSourceBadgeProps } from "./HcSourceBadge";

export { HcMetricSparkline } from "./HcMetricSparkline";
export type { HcMetricSparklineProps, HcSparklineTone } from "./HcMetricSparkline";

export { HcValueChart } from "./HcValueChart";
export type { HcValueChartProps, HcValuePoint } from "./HcValueChart";

export { HcFanChart } from "./HcFanChart";
export type { HcFanChartProps, HcFanBand } from "./HcFanChart";

export { HcWaterfall } from "./HcWaterfall";
export type { HcWaterfallProps, HcWaterfallStep } from "./HcWaterfall";

export { HcCompositionRing } from "./HcCompositionRing";
export type { HcCompositionRingProps, HcCompositionSegment } from "./HcCompositionRing";

export { HcAssumptionLedger } from "./HcAssumptionLedger";
export type { HcAssumptionLedgerProps } from "./HcAssumptionLedger";

export { HcHeatmap } from "./HcHeatmap";
export type { HcHeatmapProps, HcHeatCell } from "./HcHeatmap";

export { HcPlotEmpty, HC_PLOT_EMPTY_MAX_HEIGHT } from "./HcPlotEmpty";
export type { HcPlotEmptyProps } from "./HcPlotEmpty";
