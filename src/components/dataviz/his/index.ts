/**
 * Hearst Instrument System (HIS) — P0 visual primitives barrel.
 *
 * Single import surface for the data-viz primitives. Product surfaces
 * (portfolio, payments, projection, investor report) consume these in later
 * lots (P1/P2); this lot ships the library + tests only, nothing is wired yet.
 *
 * Not yet implemented (P1+): HcLineChart, HcBandChart, HcStackedBar,
 * HcContributionBar, HcTimeline, HcHeatmap, HcTornado, HcBullet, HcSourceMatrix,
 * HcDependencyDiagram.
 */

export * from "./types";
export * from "./geometry";

export { HcChartCard } from "./HcChartCard";
export type { HcChartCardProps, HcChartCardState } from "./HcChartCard";

export { HcSourceBadge } from "./HcSourceBadge";
export type { HcSourceBadgeProps } from "./HcSourceBadge";

export { HcMetricSparkline } from "./HcMetricSparkline";
export type { HcMetricSparklineProps, HcSparklineTone } from "./HcMetricSparkline";

export { HcFanChart } from "./HcFanChart";
export type { HcFanChartProps, HcFanBand } from "./HcFanChart";

export { HcWaterfall } from "./HcWaterfall";
export type { HcWaterfallProps, HcWaterfallStep } from "./HcWaterfall";

export { HcCompositionRing } from "./HcCompositionRing";
export type { HcCompositionRingProps } from "./HcCompositionRing";

export { HcAssumptionLedger } from "./HcAssumptionLedger";
export type { HcAssumptionLedgerProps } from "./HcAssumptionLedger";
